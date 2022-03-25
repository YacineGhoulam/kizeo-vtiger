const app = require("express")();
const CRM = require("vtiger");
const request = require("request");
const bodyParser = require("body-parser");

app.use(bodyParser.json());

let connection = new CRM.Connection(
	"https://digimium2.od2.vtiger.com",
	"yacine@digimium.fr",
	"Kn5kbakmLT3UDZWE"
);

const email = {
	date_start: "25-03-2022",
	subject: "test",
	from_email: "nadir@digimium.fr",
	saved_toid: "yacine@digimium.fr",
	assigned_user_id: "19x141",
};
connection.login().then(() => connection.create("Emails", email));
