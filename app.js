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

const getAllLists = () => {
	const options = {
		url: `${API_URL}/lists`,
		headers: API_HEADER,
	};

	function callback(error, response, body) {
		if (!error && response.statusCode == 200) {
			body = JSON.parse(body);
			getAccountsListId(body.lists);
		} else {
			console.log("getAllLists => oops");
		}
	}
	request(options, callback);
};

const getAccountsListId = (lists) => {
	lists = lists.filter((list) => list.name === "Accounts");
	const listId = lists[0].id;
	getAllAccounts(listId);
};

const getAllAccounts = (listId) => {
	const options = {
		url: `${API_URL}/lists/${listId}/complete`,
		headers: API_HEADER,
	};
	function callback(error, response, body) {
		if (!error) {
			body = JSON.parse(body);
			let items = body.list.items;
			addAccount(items, listId);
		} else {
			console.log(error);
		}
	}
	request(options, callback);
};

const addAccount = (items, listId) => {
	const item = "007|Oran|Hai Yasmine|315510|Bir el Djir";
	items.push(item);

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
		console.log(body);
	}
	request.put(options, callback);
};

app.get("/", (req, res) => {
	res.send("<h1>Hello Bebe</h1>");
});

app.post("/addAccount", (req, res) => {
	getAllLists();
	res.sendStatus(200);
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
	console.log("Listening on Port " + PORT);
});
