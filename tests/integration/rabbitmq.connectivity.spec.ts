import * as amqp from 'amqplib';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('RabbitMQ Connectivity Integration Test', () => {
  const rabbitUrl =
    process.env.RABBITMQ_URL || 'amqp://hms_rabbit:hms_rabbit_dev_pass_2026@localhost:5672/';

  it('should successfully connect, assert a queue, publish and consume a test message', async () => {
    const conn = await amqp.connect(rabbitUrl);
    expect(conn).toBeDefined();

    const ch = await conn.createChannel();
    const testQueue = 'test_connectivity_queue';

    await ch.assertQueue(testQueue, { durable: false, autoDelete: true });

    const messageContent = JSON.stringify({ event: 'ping', timestamp: Date.now() });
    ch.sendToQueue(testQueue, Buffer.from(messageContent));

    const received = await new Promise<amqp.ConsumeMessage | null>((resolve) => {
      ch.consume(
        testQueue,
        (msg) => {
          if (msg) {
            ch.ack(msg);
            resolve(msg);
          }
        },
        { noAck: false },
      );
    });

    expect(received).not.toBeNull();
    expect(received?.content.toString()).toBe(messageContent);

    await ch.deleteQueue(testQueue);
    await ch.close();
    await conn.close();
  });
});
