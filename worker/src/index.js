const { Kafka } = require('kafkajs');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config();
const mysql = require('mysql2/promise');
const { WebSocketServer } = require('ws');
const EXECUTION_TIMEOUT_MS = 10000;

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT
});

const LANGUAGE_CONFIG = {
    python: {
        image: 'python:3.11-slim',
        filename: 'main.py',
        compileCmd: null,
        runCmd: 'python3 -u /code/main.py'
    },
    java: {
        image: 'eclipse-temurin:21-jdk',
        filename: 'Main.java',
        compileCmd: 'javac /code/Main.java',
        runCmd: 'java -cp /code Main'
    },
    cpp: {
        image: 'gcc:12',
        filename: 'main.cpp',
        compileCmd: 'g++ /code/main.cpp -o /code/main',
        runCmd: '/code/main'
    }
};

const executeCode = (submissionId, language, code, input , onData) => {
    return new Promise((resolve, reject) => {
        const config = LANGUAGE_CONFIG[language];
        if (!config) return reject(new Error(`Unsupported language: ${language}`));

        const tempDir = path.join('D:\\', 'tmp', 'submissions', submissionId);
        fs.mkdirSync(tempDir, { recursive: true });
        fs.writeFileSync(path.join(tempDir, config.filename), code);

        let fullOutput = '';

        const runDockerCmd = (dockerArgs, stdin = '') => {
            return new Promise((res, rej) => {
                const proc = spawn('docker', dockerArgs);

                if (stdin) {
                    proc.stdin.write(stdin);
                    proc.stdin.end();
                }

                proc.stdout.on('data', (data) => {
                    const line = data.toString();
                    fullOutput += line;
                    onData(line);
                });

                proc.stderr.on('data', (data) => {
                    const line = data.toString();
                    fullOutput += line;
                    onData(line);
                });

                proc.on('close', (code) => {
                    if (code === 0) res();
                    else rej(new Error(`Process exited with code ${code}`));
                });
            });
        };

        const execute = async () => {
            const forwardPath = tempDir.replace(/\\/g, '/');
            fs.writeFileSync(path.join(tempDir, 'input.txt'), input || '');

            const containerName = `sandbox-${submissionId}`;
            let timeoutHandle;

            try {
                if (config.compileCmd) {
                    await runDockerCmd([
                        'run', '--rm', '--memory=128m', '--cpus=0.5', '--network', 'none',
                        '-v', `${forwardPath}:/code`,
                        config.image,
                        'sh', '-c', config.compileCmd
                    ]);
                }

                timeoutHandle = setTimeout(() => {
                    spawn('docker', ['kill', containerName]);
                }, EXECUTION_TIMEOUT_MS);

                await runDockerCmd([
                    'run', '--rm', '--name', containerName,
                    '--memory=128m', '--cpus=0.5', '--network', 'none',
                    '-v', `${forwardPath}:/code`,
                    config.image,
                    'sh', '-c', `${config.runCmd} < /code/input.txt`
                ]);

                clearTimeout(timeoutHandle);
                resolve(fullOutput);
            } catch (err) {
                clearTimeout(timeoutHandle);
                const isTimeout = err.message.includes('137');
                reject(new Error(isTimeout ? 'Time limit exceeded' : err.message));
            } finally {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        };

        execute().catch(reject);
    });
};

const saveResult = async (submissionId, language, code, output, status) => {
    const query = `
        INSERT INTO submissions (submission_id, language, code, output, status)
        VALUES (?, ?, ?, ?, ?)
    `;
    await pool.execute(query, [submissionId, language, code, output, status]);
    console.log(`Result saved to DB — ${submissionId} — ${status}`);
};

const kafka = new Kafka({
    clientId: 'worker',
    brokers: ['localhost:9092']
});

const consumer = kafka.consumer({ groupId: 'code-execution-workers' });

const run = async () => {   
    await consumer.connect();
    console.log('Worker connected to Kafka');

    await consumer.subscribe({ topic: 'submissions', fromBeginning: false });
    console.log('Subscribed to submissions topic');

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const submission = JSON.parse(message.value.toString());
            console.log('Received submission:', submission);

            const ws = clients.get(submission.submissionId);

            const sendToClient = (line) => {
                if (ws && ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: 'output', data: line }));
                }
            };

            try {
                const output = await executeCode(
                    submission.submissionId,
                    submission.language,
                    submission.code,
                    submission.input || '',
                    sendToClient
                );

                if (ws && ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: 'done', data: output }));
                }

                await saveResult(submission.submissionId, submission.language, submission.code, output, 'success');
            } catch (err) {
                console.error('Execution failed:', err.message);

                if (ws && ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: 'error', data: err.message }));
                }

                await saveResult(submission.submissionId, submission.language, submission.code, err.message, 'error');
            }
        }
    });
};

const wss = new WebSocketServer({ port: 8080 });
const clients = new Map();

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const { submissionId } = JSON.parse(message.toString());
        clients.set(submissionId, ws);
        console.log(`WebSocket client registered for: ${submissionId}`);
    });

    ws.on('close', () => {
        console.log('WebSocket client disconnected');
    });
});

console.log('WebSocket server running on port 8080');

run().catch((err) => {
    console.error('Worker failed to start:', err);
    process.exit(1);
});