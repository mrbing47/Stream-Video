const path = require("path");
const fs = require("fs");
const fsp = require("fs").promises;

const express = require("express");
const app = express();

const morgan = require("morgan");
const script = require("./script/script.js");

//const dotenv = require("dotenv").config({ path: path.join(__dirname + "/.env") });
//const expand = require("dotenv-expand");

//expand(dotenv);

const frontend = path.join(__dirname, process.env.FRONTEND);

app.set("view engine", "ejs");
app.set("views", path.join(frontend, "/html"));

app.use(morgan("short"));

app.use((req, res, next) => {
	//res.set("Cache-Control", "public, max-age=86400");
	next();
});

app.use(express.static(frontend));

var videoDetails = undefined;

app.get("/", (req, res) => {
	const encryptPath = script.encryptPath("root");
	res.render("index", { data: videoDetails, path: encryptPath });
});

app.get("/file", (req, res) => {
	const decryptPath = script.decryptPath(req.query.path);

	const fileParts = req.query.folder.split(".");
	const fileTitle = [...fileParts.slice(0, -1)].join(".");
	const fileExt = fileParts.slice(-1)[0];

	console.log(fileTitle);
	console.log(fileExt);

	const pathReq = path.join(decryptPath, "\\", fileTitle).trim();

	console.log(pathReq);

	const result = script.iterateDir(videoDetails, pathReq, fileExt);

	if (result == 404) {
		res.status(404).send("Wrong Video!!!");
		return;
	}

	console.log(result);

	const pathArr = pathReq.split("\\");
	pathArr.shift();

	const filePath = path.join(process.env.ROOT, pathArr.join("\\") + "." + fileExt);
	const fileSize = fs.statSync(filePath).size;

	const range = req.headers.range;

	if (range) {
		const parts = range.replace(/bytes=/, "").split("-");
		const start = parseInt(parts[0], 10);
		const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

		if (start >= fileSize) {
			res.status(416).send("Requested range not satisfiable\n" + start + " >= " + fileSize);
			return;
		}

		const chunksize = end - start + 1;
		const file = fs.createReadStream(filePath, { start, end });
		const head = {
			"Content-Range": `bytes ${start}-${end}/${fileSize}`,
			"Accept-Ranges": "bytes",
			"Content-Length": chunksize,
			"Content-Type": "video/mp4"
		};

		res.writeHead(206, head);
		file.pipe(res);
	} else {
		const head = {
			"Content-Length": fileSize,
			"Content-Type": "video/mp4"
		};
		res.writeHead(200, head);
		fs.createReadStream(filePath).pipe(res);
	}
});

app.get("/tn/:tn", (req, res) => {
	fs.readdir(process.env.TN, (err, data) => {
		if (err) {
			res.status(500).send(err);
			return;
		}

		console.log(data);

		if (data.includes(req.params.tn))
			res.sendFile(path.join(process.env.TN, "/" + req.params.tn));
		else res.status(404).send("INCORRECT id");
	});
});

app.get("/folder", (req, res) => {
	const decryptPath = script.decryptPath(req.query.path);
	const pathReq = path.join(decryptPath, "\\", req.query.folder).trim();

	console.log(pathReq);

	const result = script.iterateDir(videoDetails, pathReq);

	if (result == 404 || Object.prototype.toString.call(result) != "[object Array]") {
		res.status(404).send("Wrong Path!!!");
		return;
	}

	const encryptPath = script.encryptPath(pathReq);
	res.render("index", { data: result, path: encryptPath });
});

const PORT = process.env.PORT || 4769;

const updateAndListen = async function() {
	try {
		await script.updateDetails();

		const data = await fsp.readFile(process.env.JSON_FILE);

		var result = JSON.parse(data);
		videoDetails = result;
	} catch (err) {
		console.log(err);
	}
	console.log("Listening to PORT => " + PORT);
};

app.listen(PORT, updateAndListen);