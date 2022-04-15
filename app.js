const app = require("express")();
const CRM = require("vtiger");
const request = require("request");
const bodyParser = require("body-parser");
const axios = require("axios");
const minify = require("url-minify");
const {
	getAllLists,
	AddCommentToAccount,
	CommentTimeInterval,
} = require("./functions");

let connection = new CRM.Connection(
	"https://digimium2.od2.vtiger.com",
	"yacine@digimium.fr",
	"Kn5kbakmLT3UDZWE"
);
const vtigerBaseUrl =
	"https://digimium2.od2.vtiger.com/restapi/v1/vtiger/default";

const vtigerHeader = {
	auth: {
		username: "yacine@digimium.fr",
		password: "Kn5kbakmLT3UDZWE",
	},
};

const API_URL = "https://www.kizeoforms.com/rest/v3";
const API_TOKEN =
	"chouba_at_digimiumfr_b72c80226c3d92558e77afe8456ac6f71c52cae7";
const API_HEADER = {
	Authorization: API_TOKEN,
};

app.use(bodyParser.json());

setInterval(AddCommentToAccount, CommentTimeInterval);

// REQUESTS ROUTES

app.get("/kizeo", (req, res) => {
	res.send("<h1>Hello Bebe</h1>");
});

app.post("/kizeo/addAccount", (req, res) => {
	if (req.body[0].id) {
		let id = req.body[0].id;
		getAllLists(id, "Accounts");
	}
	res.sendStatus(200);
});

app.post("/kizeo/addProduct", (req, res) => {
	if (req.body[0].id) {
		let id = req.body[0].id;
		getAllLists(id, "Products");
	}
	res.sendStatus(200);
});

app.post("/kizeo/addStock", (req, res) => {
	if (req.body[0].id) {
		let id = req.body[0].id;
		console.log(id);
		//getAllLists(id, "Stock");
	}
	res.sendStatus(200);
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
	console.log("Listening on Port " + PORT);
});
