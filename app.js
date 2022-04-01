const app = require("express")();
const CRM = require("vtiger");
const request = require("request");
const bodyParser = require("body-parser");
const axios = require("axios");
const fs = require("fs");

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

/* CREATING NEW CASES FOR EACH FORM
	Every 10min we:
	1- Get a list from Kizeo of filled forms in last 10min
	2- Extract 
*/
const CommentTimeInterval = 1000 * 60 * 5; // 10 minutes

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
		setAccountComment(responseData, accountId);
	});
};

const setAccountComment = (responseData, accountId) => {
	let {
		personne_presente_sur_site_firstname,
		personne_presente_sur_site_lastname,
		date_debut_d_intervention,
		heure_debut_intervention,
		type_d_intervention,
		lieu_d_intervention_address,
		adresse,
	} = responseData;
	adresse = lieu_d_intervention_address.value
		? lieu_d_intervention_address.value
		: adresse.value;

	const commentcontent = `Une intervention ${type_d_intervention.value} a été réalisée par ${personne_presente_sur_site_firstname.value} ${personne_presente_sur_site_lastname.value} le ${date_debut_d_intervention.value} à ${heure_debut_intervention.value} sur le site ${adresse}`;
	const comment = {
		commentcontent: commentcontent,
		assigned_user_id: "19x141",
		related_to: accountId,
	};
	let url = encodeURI(
		vtigerBaseUrl +
			`/create?elementType=ModComments&element=${JSON.stringify(
				comment
			)}`
	);

	axios.post(url, {}, vtigerHeader).then((response) =>
		console.log(response.data)
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

setInterval(AddCommentToAccount, CommentTimeInterval);

/* UPDATING KIZEO LIST
	1- Receive request with Id of updated/created Record.
	2- Get All Lists from Kizeo and extract Record list Id.
	3- Extract all records currently in Kizeo list.
	4- Get the updated/created Record information and add it to the list.
*/

const getAllLists = (recordId, recordType) => {
	const options = {
		url: `${API_URL}/lists`,
		headers: API_HEADER,
	};

	function callback(error, response, body) {
		if (!error && response.statusCode == 200) {
			body = JSON.parse(body);
			console.log("getAllLists: " + recordType);
			getListId(body.lists, recordId, recordType);
		} else {
			console.log("getAllLists => oops");
		}
	}
	request(options, callback);
};

const getListId = (lists, recordId, recordType) => {
	lists = lists.filter((list) => list.name === recordType);
	const listId = lists[0].id;
	getAllRecords(listId, recordId, recordType);
};

const getAllRecords = (listId, recordId, recordType) => {
	const options = {
		url: `${API_URL}/lists/${listId}/complete`,
		headers: API_HEADER,
	};
	function callback(error, response, body) {
		if (!error) {
			body = JSON.parse(body);
			let items = body.list.items;
			if (recordType === "Accounts")
				getLastAccount(items, listId, recordId);
			if (recordType === "Products")
				getLastProduct(items, listId, recordId);
		} else {
			console.log(error);
		}
	}
	request(options, callback);
};

const getLastAccount = (items, listId, recordId) => {
	connection
		.login()
		.then(() =>
			connection.query(
				"SELECT account_no, accountname, bill_city, bill_code, bill_street, email1 FROM Accounts WHERE id='" +
					recordId +
					"';"
			)
		)
		.then((account) => {
			let {
				account_no,
				accountname,
				bill_city,
				bill_code,
				bill_street,
				email1,
			} = account[0];
			let itemString = `${accountname}|${account_no}|${bill_city}|${bill_code}|${bill_street}|${email1}`;

			// If Item exists, remove it (modification)
			items = items.filter((item) => !item.includes(account_no));
			items.unshift(itemString);
			addRecord(items, listId);
			console.log("Kizeo Add Account");
		});
};

const getLastProduct = (items, listId, recordId) => {
	connection
		.login()
		.then(() =>
			connection.query(
				"SELECT productname, productcode FROM Products WHERE discontinued = 1 AND id='" +
					recordId +
					"';"
			)
		)
		.then((product) => {
			let { productname, productcode } = product[0];
			let itemString = `${productname}|${productcode}`;

			// If Item exists, remove it (modification)
			items = items.filter((item) => !item.includes(productname));
			items.unshift(itemString);
			addRecord(items, listId);
			console.log("Kizeo Add Product");
		});
};

const addRecord = (items, listId) => {
	const options = {
		url: `${API_URL}/lists/${listId}`,
		headers: API_HEADER,
		json: true,
		body: { items: items },
	};

	function callback(err, res, body) {
		if (err) {
			console.log(err);
		}
	}
	request.put(options, callback);
};

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
