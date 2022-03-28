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

const API_URL = "https://www.kizeoforms.com/rest/v3";
const API_TOKEN =
	"chouba_at_digimiumfr_b72c80226c3d92558e77afe8456ac6f71c52cae7";
const API_HEADER = {
	Authorization: API_TOKEN,
};

/* CREATING NEW CASES FOR EACH FORM
	Every 10min we:
	1- Get a list from Kizeo of filled forms in last 10min
	2- Extract 
*/
const fiveMinutes = 5000;

const AddProductToClient = (formId = 782857) => {
	const options = {
		url: `${API_URL}/forms/${formId}/data/all`,
		headers: API_HEADER,
	};

	function callback(error, response, body) {
		if (!error && response.statusCode == 200) {
			body = JSON.parse(body);
			const allResponses = body.data;
			const recentResponses = allResponses.filter((response) => {
				let currentDate = new Date().getTime();
				let responseDate = new Date(
					response.create_time
				).getTime();
				return (
					currentDate - responseDate <
					1000 * 60 * 60 * 24 * 5
				); // 5 days
			});
			recentResponses.forEach((response) => {
				let responseId = response.id;
				getFormResponse(formId, responseId);
			});
		} else {
			console.log(error);
		}
	}
	request(options, callback);
};

const getFormResponse = (formId, responseId) => {
	const options = {
		url: `${API_URL}/forms/${formId}/data/${responseId}`,
		headers: API_HEADER,
	};

	function callback(error, response, body) {
		if (!error && response.statusCode == 200) {
			body = JSON.parse(body);
			let listeMateriel = body.data.fields.liste_du_materiel.value;
			console.log(listeMateriel[1]);
		} else {
			console.log(error);
		}
	}
	request(options, callback);
};

setInterval(AddProductToClient, fiveMinutes);

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
