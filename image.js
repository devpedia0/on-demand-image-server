const express = require('express');
const router = express.Router();
const Jimp = require('jimp');
const AWS = require('aws-sdk');
const logger = require('./config/logger');
const stream = require('stream');
const dotenv = require('dotenv');
dotenv.config(); // LOAD CONFIG

router.use((req, res, next) => {
	console.log('Time: ', Date.now());
	next();
});

router.get('/', (req, res) => {
	res.send('Image home page');
});

router.get('/:path([A-Za-z0-9]+\/{1}[A-Za-z0-9-]+\.[a-z]{3,})', async (req, res) => {
    logger.info(req.params.path);
    try {
        const data = await downloadFile(req.params.path);
        
        const quality = req.query.q && Number(req.query.q) < 100 ? Number(req.query.q) : 100;
        const width = req.query.w ? Number(req.query.w) : 1280;
        const height = req.query.h ? Number(req.query.h) : 1280;

        const result = await resizeImage(data.Body, quality, width, height);

        res.setHeader('Content-Length', result.contentLength);
        res.setHeader('Content-Type', result.contentType);

        result.bufferStream.pipe(res);

    } catch(err) {
        console.log("err : " + JSON.stringify(err));
        res.sendStatus(500);
    }
});

const downloadFile = (filePath) => new Promise((resolve, reject) => {
    
    const s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
        region: process.env.AWS_REGION
    });

    const options = {
        Bucket: process.env.AWS_BUCKET,
        Key: filePath
    };
    
    try {
        s3.getObject(options, (err, data) => {
            if (err) {
                logger.error('[ERROR] get S3 Object:' + err + ':' + filePath);
                reject(err);
                return;
            }

            resolve(data);
        });
    } catch(err) {
        reject(err);
    }
});

const resizeImage = (buffer, quality, width, height) => new Promise((resolve, reject) => {

    Jimp.read(buffer, (err, image) => {
        if(err || !image) {
            logger.error('[ERROR] read buffer :' + err + ':image');
            reject();
            return;
        }

        image.resize(width, height).quality(quality).getBuffer(image.getMIME(), function (err, buffer) {

            logger.info(`resize complate quality = ${quality}, width = ${width}, height = ${height}`);

            let bufferStream = new stream.PassThrough();
            bufferStream.end(buffer);

            resolve({
                contentType : image.getMIME(),
                contentLength: buffer.length,
                bufferStream : bufferStream
            });
        });
    });
});

module.exports = router;
