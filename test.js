const app = require("express")();
const CRM = require("vtiger");
const request = require("request");
const bodyParser = require("body-parser");
const axios = require("axios");

let connection = new CRM.Connection(
	"https://digimium2.od2.vtiger.com",
	"yacine@digimium.fr",
	"Kn5kbakmLT3UDZWE"
);
const vtigerHeader = {
	auth: {
		username: "yacine@digimium.fr",
		password: "Kn5kbakmLT3UDZWE",
	},
};
const header = {
	method: "GET",
	headers: {
		Authorization:
			"Basic eWFjaW5lQGRpZ2ltaXVtLmZyOktuNWtiYWttTFQzVURaV0U=",
	},
};

let id = "19x141";
const asset = {
	product: "6x1959",
	account: "3x1206193",
	dateinservice: "2022-03-28", //done
	datesold: "2022-03-28", //done
	cf_assets_propritaire: "SAV", //done
	assetname: "Casque Sans Fil - Jabra - MONO PC/Mac", //done
	serialnumber: "whb003bs", //done
	cf_assets_fournisseurs: "11x522437", //??
	cf_assets_nfacturefournisseur: "xxxxx", //??
};
const comment = {
	commentcontent: "poopééé",
	assigned_user_id: "19x141",
	related_to: "3x1206193",
};

let uri = `https://digimium2.od2.vtiger.com/restapi/v1/vtiger/default/create?elementType=ModComments&element=${JSON.stringify(
	comment
)}`;

let clientServerOptions = {
	uri: encodeURI(uri),
	method: "POST",
	headers: {
		Authorization:
			"Basic eWFjaW5lQGRpZ2ltaXVtLmZyOktuNWtiYWttTFQzVURaV0U=",
	},
};
request(clientServerOptions, function (error, response, body) {
	console.log(body);
});

app.use(bodyParser.json());
