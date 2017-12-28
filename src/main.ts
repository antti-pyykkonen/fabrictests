import { fabric } from 'fabric';
import * as fs from 'fs';

import { fabricData as fabricData } from './data';

const data = JSON.parse(fabricData);

const canvas = new fabric.Canvas();

canvas.setWidth(540);
canvas.setHeight(275);

const pngStream = fs.createWriteStream('./fabric.png');

if (data && data.backgroundImage && data.backgroundImage.src) {
  let url = data.backgroundImage.src as string;
  if (url.startsWith('//')) {
    data.backgroundImage.src = `http:${url}`;
  }
}
canvas.loadFromDatalessJSON(data, function () {
  canvas.renderAll();

  const stream = canvas.createPNGStream();

  stream.on('data', (chunk) => {
    pngStream.write(chunk);
  });

  stream.on('end', () => {
    pngStream.end();
  });

  stream.on('finish', () => {
    console.log('Write done');
  });

  stream.on('error', (error: any) => {
    console.error(error);
  });
});