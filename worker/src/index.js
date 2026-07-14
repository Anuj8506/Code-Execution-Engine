const { Kafka } = require('kafkajs');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();
const mysql = require('mysql2/promise');

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
        runCmd: 'python3 /code/main.py'
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

const executeCode = (submissionId, language, code) => {
  const config = LANGUAGE_CONFIG[language];

  if (!config) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const tempDir = path.join('D:\\', 'tmp', 'submissions', submissionId);
  fs.mkdirSync(tempDir, { recursive: true });

  const filePath = path.join(tempDir, config.filename);
  fs.writeFileSync(filePath, code);

  const dockerPath = tempDir.replace(/\\/g, '/').replace('D:', '//d');
  let output = '';

  if (config.compileCmd) {
    const compileCmd = `docker run --rm --memory="128m" --cpus="0.5" --network none -v "${dockerPath}:/code" ${config.image} sh -c "${config.compileCmd}"`;
    execSync(compileCmd, { timeout: 10000 });
  }

  const runCmd = `docker run --rm --memory="128m" --cpus="0.5" --network none -v "${dockerPath}:/code" ${config.image} sh -c "${config.runCmd}"`;
  output = execSync(runCmd, { timeout: 5000 }).toString();
  fs.rmSync(tempDir, { recursive: true, force: true });
  return output;
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

      try {
        const output = executeCode(submission.submissionId, submission.language, submission.code);
        console.log('Output:', output);
        await saveResult(submission.submissionId, submission.language, submission.code, output, 'success');
     }catch (err) {
        console.error('Execution failed:', err.message);
        await saveResult(submission.submissionId, submission.language, submission.code, err.message, 'error');
        }
    }
  });
};

run().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});