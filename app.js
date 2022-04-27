const app = require("express")();
const bodyParser = require("body-parser");
const {
	getAllLists,
	AddCommentToAccount,
	CommentTimeInterval,
	AssetsTimeInterval,
} = require("./functions");

app.use(bodyParser.json());

setInterval(() => {
	AddCommentToAccount(782857);
}, CommentTimeInterval);

setInterval(() => {
	AddCommentToAccount(798903);
}, AssetsTimeInterval);

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
	if (req.body[0].id !== undefined) {
		let id = req.body[0].id;
		getAllLists(id, "Stocks");
	}
	res.sendStatus(200);
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
	console.log("Listening on Port " + PORT);
});
