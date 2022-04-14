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

app.use(bodyParser.json());

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

const writeQuerry = (productList) => {
	let query = "SELECT id FROM Products WHERE ";
	productList.forEach((product, idx) => {
		query += `productcode='${product.product}' `;
		if (idx < productList.length - 1) query += " OR ";
	});
	return query + ";";
};

/* CREATING NEW COMMENT FOR EACH RESONSE
	Every 5min we:
	1- Get a list from Kizeo of filled forms in last 5min
	2- Extract data from each response
	3- Get correspondent Account Id
	4- Formulate and Set Comment to the Account
*/
const CommentTimeInterval = 1000 * 60 * 10; // 10 minutes

const AddCommentToAccount = (formId = 782857) => {
	const options = {
		url: `${API_URL}/forms/${formId}/data/all`,
		headers: API_HEADER,
	};
	console.log("Getting last reponses...");
	function callback(error, response, body) {
		if (!error && response.statusCode == 200) {
			body = JSON.parse(body);
			const allResponses = body.data;
			let recentResponses = allResponses.filter((response) => {
				let currentDate = new Date().getTime();
				let responseDate = new Date(
					response.create_time
				).getTime();
				return currentDate - responseDate < CommentTimeInterval;
			});

			// TREAT EVERY RESPONSE
			recentResponses.forEach((response) =>
				getResponseData(response)
			);
		} else {
			console.log(error);
		}
	}
	request(options, callback);
};

const getResponseData = (response) => {
	let { form_id, id } = response;
	const options = {
		url: `${API_URL}/forms/${form_id}/data/${id}`,
		headers: API_HEADER,
	};

	function callback(error, response, body) {
		if (!error && response.statusCode == 200) {
			body = JSON.parse(body);
			let responseData = body.data.fields;
			getAccountId(responseData);
		} else {
			console.log(error);
		}
	}
	request(options, callback);
};

const getAccountId = (responseData) => {
	let account_no = responseData.n_compte_client_dgm1.value;
	let url =
		vtigerBaseUrl +
		`/query?query=SELECT id FROM Accounts WHERE account_no='${account_no}';`;
	axios.get(url, vtigerHeader).then((response) => {
		let accountId = response.data.result[0].id;
		formatComment(responseData, accountId);
	});
};

const formatComment = (responseData, accountId) => {
	let {
		nom_de_l_intervenant,
		date_debut_d_intervention,
		heure_debut_intervention,
		type_d_intervention,
		lieu_d_intervention_address,
		adresse,
	} = responseData;
	adresse = lieu_d_intervention_address.value
		? lieu_d_intervention_address.value
		: adresse.value;

	let commentcontent = `Une intervention ${type_d_intervention.value} a été réalisée par ${nom_de_l_intervenant.value} le ${date_debut_d_intervention.value} à ${heure_debut_intervention.value} sur le site ${adresse}.`;

	const comment = {
		commentcontent: commentcontent,
		assigned_user_id: "19x10",
		related_to: accountId,
	};
	caseExist(responseData, comment);
};

const caseExist = (responseData, comment) => {
	let ticketNum = responseData.n_ticket_digimium.value;
	if (ticketNum !== "") {
		const ticketUrl = `https://digimium2.od2.vtiger.com/view/list?module=Cases&filterid=54&q=[[["case_no","contain",["${ticketNum}"]]]]`;
		minify.default(ticketUrl).then((url) => {
			comment.commentcontent += ` <br/> Il s’agissait d’une intervention dans le cadre du ticket <a href="${url.shortUrl}">${ticketNum}</a> <br/>`;
			productListExist(responseData, comment);
		});
	}
};

const productListExist = (responseData, comment) => {
	let products = responseData.liste_du_materiel.value;
	if (products.length > 0) {
		let productComment =
			"Le matériel suivant a été installé lors de cette intervention : <br/> <ul>";
		let productName = "";
		products.forEach((item) => {
			switch (item.choix1.value) {
				case "Catalogue Digimium":
					productName = item.nom_du_materiel_.value;
					break;
				case "Autres":
					productName = item.autre_produit.value;
					break;
				default:
					break;
			}
			productComment += `<li> ${productName} - Num Serie: ${item.num_serie.value} - Mac Adress: ${item.code_barres1.value} </li> `;
		});
		productComment += "</ul>";
		comment.commentcontent += productComment;
	}
	setAccountComment(comment);
};

const setAccountComment = (comment) => {
	let url = encodeURI(
		vtigerBaseUrl +
			`/create?elementType=ModComments&element=${JSON.stringify(
				comment
			)}`
	);

	axios.post(url, {}, vtigerHeader).then((response) =>
		console.log(
			"Kizeo Comment has been Added. " +
				response.data.result.commentcontent
		)
	);
};

// USELESSSSSSSSSSSSSSSSSSSSSSSSSS
const getFormProducts = (formId, responseId) => {
	const options = {
		url: `${API_URL}/forms/${formId}/data/${responseId}`,
		headers: API_HEADER,
	};

	function callback(error, response, body) {
		if (!error && response.statusCode == 200) {
			body = JSON.parse(body);

			//Extract info from form
			const {
				date_debut_d_intervention,
				n_compte_client_dgm1,
				liste_du_materiel,
				type_d_intervention,
			} = body.data.fields;

			//If there is no products skip
			if (liste_du_materiel.value.length < 1) return;

			// Array of All Form Products, Needed Info only
			let productList = liste_du_materiel.value.map((product) => ({
				product: product.n_de_serie.value, // Account Number, to get ID
				account: n_compte_client_dgm1.value, // Account Number, to get ID
				dateinservice: date_debut_d_intervention.value,
				datesold: date_debut_d_intervention.value,
				cf_assets_propritaire: type_d_intervention.value,
				assetname: product.nom_du_materiel_.value,
				serialnumber: product.n_de_serie.value,
				cf_assets_fournisseurs: "11x522437",
				cf_assets_nfacturefournisseur: "xxxxx",
			}));
			productList.forEach((product) => getAccountId(product));
		} else {
			console.log(error);
		}
	}
	request(options, callback);
};

const getProductId = (productList, account) => {
	let accoundId = account[0].id;
	// GET Product ID
	let query = writeQuerry(productList);
	connection
		.login()
		.then(() => connection.query(query))
		.then((productId) => {
			console.log(productId);
			/* productId = productId[0].id;
			product = {
				...product,
				product: productId,
				account: accoundId,
			};
			sendproduct(product); */
		});
};
AddCommentToAccount();
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

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
	console.log("Listening on Port " + PORT);
});
