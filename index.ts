import { createReadStream, createWriteStream, existsSync, statSync } from 'fs';
import { basename } from 'path';
import type { TransformCallback } from 'stream';
import { Transform } from 'stream';
import { createGzip, createBrotliCompress, createDeflate } from 'zlib';

const algorithmList = [
  {
    name: 'Gzip',
    method: createGzip,
  },
  {
    name: 'Brotli',
    method: createBrotliCompress,
  },
  {
    name: 'Deflate',
    method: createDeflate,
  },
];

const filePath = process.argv[2];
const fileName = basename(filePath);

if (!filePath || !existsSync(filePath)) {
  console.error('Error: Valid file path is required');
  process.exit(1);
}

function createMonitor() {
  let byteCount = 0;
  const startTime = Date.now();
  let speed = 0;

  const monitor = new Transform({
    transform(chunk: Buffer, _: BufferEncoding, callback: TransformCallback) {
      byteCount += chunk.length;
      const timeInSeconds = (Date.now() - startTime) / 1000;
      speed = Math.round(byteCount / timeInSeconds);
      callback(null, chunk);
    },
    flush(callback: TransformCallback) {
      callback();
    },
  });

  return {
    stream: monitor,
    getByteCount: () => byteCount,
    getSpeed: () => speed,
  };
}

function compressFile(algorithm: { name: string; method: () => Transform }) {
  const { name, method } = algorithm;
  const { stream, getByteCount, getSpeed } = createMonitor();
  const input = createReadStream(fileName);
  const output = createWriteStream(`${fileName}.${name.toLowerCase()}`);
  const compress = method();
  const originalSize = statSync(filePath).size;
  input.pipe(compress).pipe(stream).pipe(output);

  output.on('finish', () => {
    const reductionPercentage = ((originalSize - getByteCount()) / originalSize) * 100;
    console.log(
      `${name}: ${originalSize} bytes -> ${getByteCount()} bytes (${reductionPercentage.toFixed(
        1
      )}% ${getSpeed()} bytes/s)`
    );
  });
}

function main() {
  for (const algorithm of algorithmList) {
    compressFile(algorithm);
  }
}

main();
