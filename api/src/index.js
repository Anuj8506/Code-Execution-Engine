require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: parseInt(process.env.MYSQL_PORT),
});

const app = express();
app.use(cors());
app.use(express.json());

const kafka = new Kafka({
  clientId: 'code-execution-api',
  brokers: ['localhost:9092'],
});

const producer = kafka.producer();

async function connectProducer() {
  await producer.connect();
  console.log('Kafka producer connected');
}

connectProducer().catch((err) => {
  console.error('Failed to connect Kafka producer:', err);
  process.exit(1);
});

app.post('/submit', async (req, res) => {
  const { code, language, submissionId: bodyId, input } = req.body;

  if (!code || !language) {
    return res.status(400).json({ error: 'code and language are required' });
  }

  const submissionId = bodyId || uuidv4();

  await producer.send({
    topic: 'submissions',
    messages: [
      {
        key: submissionId,
        value: JSON.stringify({ submissionId, code, language, input: input || '' }),
      },
    ],
  });

  console.log(`Submission queued: ${submissionId} | language: ${language}`);

  res.status(202).json({ submissionId });
});

app.get('/submissions', async (req, res) => {
  const [rows] = await db.query(
    'SELECT submission_id, language, status, created_at, output, code FROM submissions ORDER BY created_at DESC LIMIT 50'
  );
  res.json(rows);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});