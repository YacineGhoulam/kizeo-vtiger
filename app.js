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

const getAllLists = (recordId) => {
	const options = {
		url: `${API_URL}/lists`,
		headers: API_HEADER,
	};

	function callback(error, response, body) {
		if (!error && response.statusCode == 200) {
			body = JSON.parse(body);
			getAccountsListId(body.lists, recordId);
		} else {
			console.log("getAllLists => oops");
		}
	}
	request(options, callback);
};

const getAccountsListId = (lists, recordId) => {
	lists = lists.filter((list) => list.name === "Accounts");
	const listId = lists[0].id;
	getAllAccounts(listId, recordId);
};

const getAllAccounts = (listId, recordId) => {
	const options = {
		url: `${API_URL}/lists/${listId}/complete`,
		headers: API_HEADER,
	};
	function callback(error, response, body) {
		if (!error) {
			body = JSON.parse(body);
			let items = body.list.items;
			getLastAccount(items, listId, recordId);
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
			let itemString = `${account_no}|${accountname}|${bill_city}|${bill_code}|${bill_street}|${email1}`;

			// If Item exists, remove it (modification)
			items = items.filter((item) => !item.includes(account_no));
			items.unshift(itemString);
			addAccount(items, listId);
			console.log("Kizeo Add Account");
		});
};

const addAccount = (items, listId) => {
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
		getAllLists(id);
	}
	res.sendStatus(200);
});
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
	console.log("Listening on Port " + PORT);
});
