import { fabric } from 'fabric';
import * as http from 'http';
import * as https from 'https';

import * as fs from 'fs';
import * as jsdom from 'jsdom';
import * as mkdir from 'mkdirp';

import { fabricDataThree as fabricData } from './data';

const canvas = new fabric.Canvas();
const fields: {name: string, value: string}[] = [
  { name: 'backgroundImage.src', value: 'http://www.pixelcg.com/blog/wp-content/uploads/2009/03/ash_uvgrid03.jpg'},
  { name: 'objects.0.text', value: 'HELLO MATE'},
  { name: 'objects.1.objects.1.text', value: 'HELLO TO YOU'}

];
canvas.setWidth(540);
canvas.setHeight(275);

function renderImage(data) {
  
  const pngStream = fs.createWriteStream('./fabric2.png');
  
  if (data && data.backgroundImage && data.backgroundImage.src) {
    let url = data.backgroundImage.src as string;
    if (url.startsWith('//')) {
      data.backgroundImage.src = `http:${url}`;
    }
  }

  if (fields) {
    for (const fieldIdx in fields) {
      const field = fields[fieldIdx];

      if (field && field.name && field.value) {
        let f = data;

        const keys = field.name.split('.');

        for (const k in keys) {
          if (f && f[keys[k]]) {
            if (f[keys[k]] instanceof Object) {
              f = f[keys[k]];
            } else {
              break;
            }
          } else {
            f = null;
          }
        }

        if (f) {
          // f = field.value;
          // console.log(f);
          // delete f[field.name];
          const lastKey = field.name.split('.').pop();
          f[lastKey] = field.value;
          // console.log(f, f[field.name]);
          // // f[field.name] = field.value;
          // console.log([f[field.name]]);
        }
      }
    }
  }

  // console.log(data.backgroundImage.src);


  canvas.loadFromDatalessJSON(data, function () {
    const { width, height } = canvas.backgroundImage.getOriginalSize();
    // console.log(canvas.backgroundImage.getOriginalSize());
    // canvas.backgroundImage.viewportCenter();
    // canvas.backgroundImage.setCoords();
    canvas.backgroundImage.set('height', height);
    canvas.backgroundImage.set('width', width);
    // canvas.backgroundImage.set('originX', 'center');
    // canvas.backgroundImage.set('originY', 'center');
    

    canvas.backgroundImage.set('left', 540 / 2);
    canvas.backgroundImage.set('top', 270 / 2);

    canvas.backgroundImage.center();

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
}

function resolveFontManifest(): Promise<any> {
  const googleFontsPath = '/tmp/google_fonts.json';
  const apiKey = 'AIzaSyDz43q1vNyBuOAq1KUj26fjFxGgie_0JP4';
  const apiUrl = `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}`;

  let manifestData: string = '';

  const promise = new Promise((resolve, reject) => {
    if (fs.existsSync(googleFontsPath)) {
      const fileStream = fs.createReadStream(googleFontsPath);
  
      fileStream.on('data', (chunk) => manifestData += chunk);
      fileStream.on('end', () => {
        const manifestObject = JSON.parse(manifestData);
        resolve(manifestObject);
      });
  
    } else {
      const stream = fs.createWriteStream(googleFontsPath);
      https.get(apiUrl, (res) => {
        res.on('data', (chunk) => {
          manifestData += chunk;
          stream.write(chunk);
        });
  
        res.on('end', () => {
          stream.close();
  
          const manifestObject = JSON.parse(manifestData);
          resolve(manifestObject);
        });
      });
    }
  });

  return promise;
}

function handleFabricRender() {
  const dataObject = JSON.parse(fabricData);
  resolveFontManifest()
    .then(manifest => {
      return handleFontLoading(dataObject, manifest);
    }).then(() => {
      renderImage(dataObject);
    });
}

function handleFontLoading(fabricData: any, manifest: any): Promise<void> {
  let promises: Promise<any>[] = [];
  // console.log('loading fonts');
  let manifestFonts = fetchFontFiles(fetchFonts(fabricData), manifest);
  // console.log('got manifest fonts');

  manifestFonts.forEach(requestFont => {
    const fontResolved = new Promise((resolve, reject) => {
      // console.log(requestFont);
      const exists = fs.existsSync(`/tmp/fonts/${requestFont.family}/font.ttf`);
      if (!exists) {
        // console.log('does not exist');

        mkdir.sync(`/tmp/fonts/${requestFont.family}`);

        const stream = fs.createWriteStream(`/tmp/fonts/${requestFont.family}/font.ttf`);
        http.get(requestFont.file, (res) => {
          res.pipe(stream);

          stream.on('close', () => {
            resolve(requestFont.family);
          });
        });
      } else {
        resolve(requestFont.family);
      }
    });

    promises.push(fontResolved);
  })

  return Promise.all(promises).then(prom => {
    prom.forEach(fnt => {
      fabric.nodeCanvas.registerFont(`/tmp/fonts/${fnt}/font.ttf`, { family: fnt })
    })
  });
}

function fetchFonts(fabricData: { objects: any[] }) {

  const fonts = fabricData.objects.map(object => {
    let innerObjects = object.objects || [];
    let innerFonts = innerObjects.map(object => object.fontFamily);
    return [object.fontFamily, ...innerFonts]
      .filter(font => font != null)
  })
    .reduce((prev, cur) => {
      return prev.concat(cur);
    })
    .reduce((prev: Array<any>, cur) => {
      if (!prev.includes(cur)) {
        prev.push(cur)
      }

      return prev;
    }, []);


  return fonts;
}

function fetchFontFiles(wantedFonts: any[], googleFontData) {
  return googleFontData.items
    .filter(x => {
      return wantedFonts.includes(x.family);
    })
    .map(font => {
      const variant = font.variants.includes('regular') ? 'regular' : font.variants[0];
      const file = font.files[variant];

      return { family: font.family, file: file };
    });
}

handleFabricRender();