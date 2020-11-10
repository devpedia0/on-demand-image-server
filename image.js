let express = require('express');
let router = express.Router();
let Jimp = require('jimp');
let AWS = require('aws-sdk');
let logger = require('./config/logger');
let stream = require('stream');

router.use(function timeLog(req, res, next) {
	console.log('Time: ', Date.now());
	next();
});

router.get('/', function(req, res) {
	res.send('Image home page');
});

router.get('/resize/:target/:filename', async (req, res) => {

    try {
        //logger.debug('resize : ' + req.params.target + '/' + req.params.id + '/' + req.params.filename);
        logger.info('resize : ' + req.params.target + '/' + req.params.id + '/' + req.params.filename);

        let data = await downloadFile(req.params.target + '/' + req.params.filename);
        let result = await resizeImage(data.Body, Number(req.query.size === null || req.query.size===undefined ? 1280 : req.query.size), Number(req.query.quality === null || req.query.quality > 100 || req.query.quality===undefined ? 100 : req.query.quality));

        res.setHeader('Content-Length', result.contentLength);
        res.setHeader('Content-Type', result.contentType);

        result.bufferStream.pipe(res);

    } catch(err) {
        console.log("err : " + JSON.stringify(err));
        res.sendStatus(500);
    }
});

let downloadFile = (key) => new Promise((resolve, reject) => {

    let s3 = new AWS.S3();

    let options = {
        Bucket: 'watchapedia',
        Key: key
    };

    try {
        s3.getObject(options, function (err, data) {
            if (err) {
                logger.error('[ERROR] get S3 Object:' + err + ':' + key);
                reject(err);
            } else {
                resolve(data);
            }
        });
    } catch(err) {
        reject(err);
    }
});

let resizeImage = (buffer, size, quality) => new Promise((resolve, reject) => {

    Jimp.read(buffer, function (err, image) {
        if(err || image === null) {
            logger.error('[ERROR] read buffer :' + err + ':image');
            reject();
        } else {
            image.resize(size, Jimp.AUTO).quality(quality).getBuffer(image.getMIME(), function (err, buffer) {

                //logger.debug("resize complete");
				logger.info("resize complate change size: " + size);

                let bufferStream = new stream.PassThrough();
                bufferStream.end(buffer);

                resolve({
                    contentType : image.getMIME(),
                    contentLength: buffer.length,
                    bufferStream : bufferStream
                });
            });
        }
    });
});

module.exports = router;
