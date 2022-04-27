const app = require("express")();
const CRM = require("vtiger");
const request = require("request");
const bodyParser = require("body-parser");
const axios = require("axios");
const minify = require("url-minify");

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

const CommentTimeInterval = 1000 * 60 * 7; // 7 minutes
const AssetsTimeInterval = 1000 * 60 * 7.5; // 7.5 minutes

/* CREATING NEW COMMENT FOR EACH RESONSE
	Every 10min we:
	1- Get a list from Kizeo of filled forms in last 5min
	2- Extract data from each response
	3- Get correspondent Account Id
	4- Formulate and Set Comment to the Account
*/

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
				if (formId == 782857)
					return (
						currentDate - responseDate <
						CommentTimeInterval
					);
				else if (formId == 798903)
					return (
						currentDate - responseDate <
						AssetsTimeInterval
					);
			});
			// TREAT EVERY RESPONSE
			recentResponses.forEach((response) => {
				getResponseData(response);
			});
		} else {
			console.log(error);
		}
	}
	request(options, callback);
	console.log("------");
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
			if (form_id == 782857) getAccountId(responseData);
			else if (form_id == 798903) {
				responseData.produits.value.forEach((produit) => {
					getAccountId(produit, form_id);
				});
			}
		} else {
			console.log(error);
		}
	}
	request(options, callback);
};

const getAccountId = (responseData, form_id) => {
	let account_no = "";
	if (form_id == 798903) account_no = responseData.num_du_compte1.value;
	else if (form_id == 782857)
		account_no = responseData.n_compte_client_dgm1.value;
	let url =
		vtigerBaseUrl +
		`/query?query=SELECT id FROM Accounts WHERE account_no='${account_no}';`;
	axios.get(url, vtigerHeader).then((response) => {
		let accountId = response.data.result[0].id;
		if (form_id == 798903) getProductId(responseData, accountId);
		else if (form_id == 782857) formatComment(responseData, accountId);
	});
};

const formatComment = (responseData, accountId) => {
	let {
		personne_presente_sur_site_firstname,
		personne_presente_sur_site_lastname,
		date_debut_d_intervention,
		heure_debut_intervention,
		type_d_intervention,
		lieu_d_intervention_address,
		adresse,
		nom_de_l_intervenant,
	} = responseData;
	adresse = lieu_d_intervention_address.value
		? lieu_d_intervention_address.value
		: adresse.value;

	let commentcontent = `Une intervention ${type_d_intervention.value} a été réalisée par ${nom_de_l_intervenant} en présence de ${personne_presente_sur_site_firstname.value} ${personne_presente_sur_site_lastname.value} le ${date_debut_d_intervention.value} à ${heure_debut_intervention.value} sur le site ${adresse}.`;

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
		});
	}
	productListExist(responseData, comment);
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
			productComment += `<li> ${productName} - Num Serie: ${item.num_serie.value} - Code Barre: ${item.code_barres1.value} </li> `;
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
			if (recordType === "Stocks")
				getLastStock(items, listId, recordId);
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
				"SELECT productname, productcode, qtyinstock FROM Products WHERE discontinued = 1 AND id='" +
					recordId +
					"';"
			)
		)
		.then((product) => {
			let { productname, productcode, qtyinstock } = product[0];

			let itemString = `${productname}|${productcode}|${qtyinstock}`;

			// If Item exists, remove it (modification)
			items = items.filter((item) => !item.includes(productname));
			items.unshift(itemString);
			addRecord(items, listId);
			console.log("Kizeo Add Product");
		});
};

/*const getLastStock = (items, listId, recordId) => {
	connection
		.login()
		.then(() =>
			connection.query(
				"SELECT productname, qtyinstock FROM Products WHERE discontinued = 1 AND id='" +
					recordId +
					"';"
			)
		)
		.then((product) => {
			let { productname, qtyinstock } = product[0];
			let itemString = `${productname}|${qtyinstock}`;

			// If Item exists, remove it (modification)
			items = items.filter((item) => !item.includes(productname));
			items.unshift(itemString);
			addRecord(items, listId);
			console.log("Kizeo Add Stock");
		});
};*/

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

/* CREATING NEW COMMENT FOR EACH RESONSE
	Every 5min we:
	1- Get a list from Kizeo of filled forms in last 5min
	2- Extract data from each response
	3- Get correspondent Account Id
	4- Formulate and Set Comment to the Account
*/

const getProductId = (responseData, accountId) => {
	let productName = responseData.nom_du_produit.value;
	let url =
		vtigerBaseUrl +
		`/query?query=SELECT id FROM Products WHERE productname='${productName}';`;
	axios.get(url, vtigerHeader).then((response) => {
		responseData.prodcutId = response.data.result[0].id;
		responseData.accountId = accountId;
		getFormProducts(responseData);
	});
};

const getFormProducts = (responseData) => {
	//Extract info from form
	const {
		prodcutId,
		accountId,
		nom_du_produit,
		reference1,
		qt_produit,
		date_de_reception,
		lieu_de_reception,
		num_du_compte1,
		serial_number,
		adresse_mac,
	} = responseData;

	// Needed Info only
	let product = {
		product: prodcutId, // Done
		account: accountId, // Done
		dateinservice: date_de_reception.value, //Done
		datesold: date_de_reception.value, //Done
		cf_assets_propritaire: "STOCK", //Done
		assetname: nom_du_produit.value, //Done
		serialnumber: serial_number.value, //Done
		cf_assets_adressemac: adresse_mac.value, //Done
		cf_assets_fournisseurs: "11x5586", //Done
		cf_assets_nfacturefournisseur: "xxxxx",
		assigned_user_id: "20x47",
	};

	let url =
		vtigerBaseUrl +
		`/create?elementType=Assets&element=${JSON.stringify(product)}`;

	axios.post(url, {}, vtigerHeader).then((response) => {
		console.log("Asset has been Added.");
		//addProductStock(responseData);
	});
};

const addProductStock = (responseData) => {
	//Extract info from form
	const { prodcutId } = responseData;

	let url = vtigerBaseUrl + `/retrieve?id=${prodcutId}`;

	axios.get(url, vtigerHeader).then((response) => {
		const vendor_id = response.data.result.vendor_id;
		const qtyinstock = response.data.result.qtyinstock;
		const product = {
			id: prodcutId,
			vendor_id: vendor_id,
			qtyinstock: (parseInt(qtyinstock) + 1).toString(),
		};
		url = vtigerBaseUrl + `/revise?element=${JSON.stringify(product)}`;
		axios.post(url, {}, vtigerHeader).then((response) => {
			console.log("Product Stock has been Added.");
		});
	});
};

module.exports = {
	getAllLists: getAllLists,
	AddCommentToAccount: AddCommentToAccount,
	CommentTimeInterval: CommentTimeInterval,
	AssetsTimeInterval: AssetsTimeInterval,
};
