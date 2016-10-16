const koa = require('koa');
const app = koa();

const router = require('koa-router')();
const route = require('koa-route');
const koaBody = require('koa-body')();
const logger = require('koa-logger');
const mysql = require('./mysql');

router.get('/status', function *() {
	let connection = yield mysql.getConnection();
	let [countUsers, countThreads, countForums, countPosts] = yield [
		connection.query('select count(id) from Users;'),
		connection.query('select count(id) from Threads;'),
		connection.query('select count(id) from Forums;'),
		connection.query('select count(id) from Posts;')
	];
	let information = {
		code: 0,
		response: {
			users: countUsers[0]['count(id)'],
			threads: countThreads[0]['count(id)'],
			forums: countForums[0]['count(id)'],
			posts: countPosts[0]['count(id)']
		}
	};
	this.body = information;
});


//FORUM


router.post('/forum/create', function *() {
	let newForum = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('insert into Forums (name, short_name, user) values (?,?,?);', [newForum.name, newForum.short_name, newForum.user]);
	let fromForum = yield connection.query('select * from Forums where short_name = ?;', [newForum.short_name]);
	let information = {
		code: 0,
		response: fromForum
	};
	this.body = information;
});

router.get('/forum/details', function *(){
	let forum = this.query.forum;
	let moreInfo = this.query.related || [];
	let connection = yield mysql.getConnection();
	let forumId = yield connection.query('select * from Forums where short_name = ?;', [forum]);
	if(moreInfo === 'user') {
		let user = yield connection.query('select * from Users where email = ?;', [forumId[0].user]);
		let followers = yield connection.query('select * from Followers where followee = ? or follower = ?;', [forumId[0].user, forumId[0].user]);
		let subcriptions = yield connection.query('select * from Subscriptions where user = ?;', [forumId[0].user]);
		user[0].followers = [];
		user[0].following = [];
		followers.forEach(function (item, i) {
			user[0].followers[i] = item.follower;
			user[0].following[i] = item.followee;
		});
		user[0].subscriptions = [];
		subcriptions.forEach(function (item, i) {
			user[0].subscriptions[i] = item.thread;
		});
		forumId[0].user = user;
	}
	let information = {
		code: 0,
		response: forumId
	};
	this.body = information;
});

router.get('/forum/listPosts', function *() {
	let forum = this.query.forum;
	let forumData = this.query.since || '0000-00-00 00:00:00';
	let forumSort = this.query.order || 'desc';
	let limit = this.query.limit || -1;
	let moreInfo = this.query.related;
	let connection = yield mysql.getConnection();
	let threadInfo = {};
	let userInfo = {};
	let forumInfo = {};
	if(limmit === -1) {
		let PostInfo = yield connection.query('select date, dislikes, forum, id, isApproved, isDeleted,isEdited, isHighlighted, ' +
			'isSpam, likes , message, parent, likes - dislikes as points, thread, user from Posts where forum = ?' +
			'and date >= ? order by date ?;', [forum, forumData, forumSort]);
	} else {
		let PostInfo = yield connection.query('select date, dislikes, forum, id, isApproved, isDeleted,isEdited, isHighlighted, ' +
			'isSpam, likes , message, parent, likes - dislikes as points, thread, user from Posts where forum = ?' +
			'and date >= ? order by date ?;', [forum, forumData, forumSort, +limit]);

	}
	for(let i = 0; i < moreInfo.length;++i ){
		switch (moreInfo[i]) {
			case 'thread':
				for(let j = 0; j < PostInfo.length; ++j){
					threadInfo = yield connection.query('select date, dislikes, forum, id, isClosed, isDeleted, likes, ' +
						'message, likes - dislikes as points, posts, slug, title, user from Threads where forum = ?;',
						[PostInfo[j]. forum]);
					PostInfo[j].thread = threadInfo;
				}
				break;
			case 'user':
				for(let j = 0; j < PostInfo.length; ++j){
					userInfo = yield connection.query('select * from Users where email = ?;', [PostInfo[j].user]);
					PostInfo[j].user = userInfo[0];
				}
				break;
			case 'forum':
				for(let j = 0;j < PostInfo.length; ++j){
					forumInfo = yield connection.query('select * from Forums where short_name = ?;', [PostInfo[j].forum]);
					PostInfo[j].forum = forumInfo[0];
				}
				break;
		}
	}
	let information = {
		code: 0,
		response: PostInfo
	};
	this.body = information;
});

router.get('/forum/listThreads', function *() {
	let forum = this.query.forum;
	let forumData = this.query.since || '0000-00-00 00:00:00';
	let forumSort = this.query.order || 'desc';
	let limit = +this.query.limit || -1;
	let	moreInfo = this.query.related.split();
	let connection = yield mysql.getConnection();
	console.log(moreInfo[0]);
	let userInfo = {};
	let forumInfo = {};
	if(limit === -1) {
		let ThreadInfo = yield connection.query('select id, isClosed, isDeleted, likes, message, likes - dislikes as points, ' +
			'posts, slug, title, forum, user from Threads where forum = ?' +
			'and date >= ? order by date ?;', [forum, forumData, forumSort]);
	} else{
		let ThreadInfo = yield connection.query('select id, isClosed, isDeleted, likes, message, likes - dislikes as points, ' +
			'posts, slug, title, forum, user from Threads where forum = ?' +
			'and date >= ? order by date ? limit ?;', [forum, forumData, forumSort, +limit]);

	}
	for(let i = 0; i < moreInfo.length;++i ){
		switch (moreInfo[i]) {
			case 'user':
				for(let j = 0; j < ThreadInfo.length; ++j){
					userInfo = yield connection.query('select * from Users where email = ?;', [ThreadInfo[j].user]);
					ThreadInfo[j].user = userInfo[0];
				}
				break;
			case 'forum':
				for(let j = 0;j < ThreadInfo.length; ++j){
					forumInfo = yield connection.query('select * from Forums where short_name = ?;', [ThreadInfo[j].forum]);
					ThreadInfo[j].forum = forumInfo[0];
				}
				break;
		}
	}
	let information = {
		code: 0,
		response: ThreadInfo
	};
	this.body = information;
});

router.get('/forum/listUsers', function *() {
	let forum = this.query.forum;
	let forumSort = this.query.order || 'desc';
	let connection = yield mysql.getConnection();
	let limit = this.query.limit || -1;
	let user;
	if(limit === -1) {
		if( forumSort === 'asc') {
			user = yield connection.query('select about, email, Users.id, isAnonymous, Users.name, username from Users left join ' +
				' Forums on Users.email = Forums.user where short_name = ? order by email asc;', [forum]);
		} else {
			user = yield connection.query('select about, email, Users.id, isAnonymous, Users.name, username from Users left join ' +
				' Forums on Users.email = Forums.user where short_name = ? order by email desc;', [forum]);
		}
	} else{
		if( forumSort === 'asc') {
			user = yield connection.query('select about, email, Users.id, isAnonymous, Users.name, username from Users left join ' +
				' Forums on Users.email = Forums.user where short_name = ? order by email asc limit ?;',
				[forum, +limit]);
		} else {
			user = yield connection.query('select about, email, Users.id, isAnonymous, Users.name, username from Users left join ' +
				' Forums on Users.email = Forums.user where short_name = ? order by email desc limit ?;',
				[forum, +limit]);
		}
	}
	let subcriptions;
	let followers;
	for(let i = 0; i < user.length; ++i) {
	followers = yield connection.query('select * from Followers where followee = ? or follower = ?;', [user[i].user,user[i].user]);
	subcriptions = yield connection.query('select * from Subscriptions where user = ?;', [user[i].user]);
		user[i].followers = [];
		user[i].following = [];
		followers.forEach(function (item, i) {
			user[i].followers[i] = item.follower;
			user[i].following[i] = item.followee;
		});
		user[i].subscriptions = [];
		subcriptions.forEach(function (item, i) {
			user[i].subscriptions[i] = item.thread;
		});
	}
	let information = {
		code: 0,
		response: user
	};
	this.body = information;
});



//POST


router.post('/post/create', function *() {
	let newPost = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('insert into Posts (isApproved, user, date, message, isSpam, isHighlighted, thread, forum, ' +
		'isDeleted, isEdited) values (?,?,?,?,?,?,?,?,?,?);',
		[newPost.isApproved, newPost.user, newPost.date, newPost.message, newPost.isSpam,
			newPost.isHighlighted, newPost.thread, newPost.forum,
			newPost.isDeleted, newPost.isEdited]);
	let numOfPost = yield connection.query('select posts from Threads where id = ?', newPost.thread);
	++numOfPost[0].posts;
	yield ('insert into Threads (posts) values (?)',[numOfPost[0].posts]);
	let fromPost = yield connection.query('select date, forum,	id,	isApproved, isDeleted, isEdited, isHighlighted, ' +
		'isSpam, message, parent, thread, user from Posts where message = ? and date = ?', [newPost.message, newPost. date]);
	let information = {
		code: 0,
		response: fromPost
	};
	this.body = information;

});


//USERS


router.post('/user/create', function *() {
	let newUser = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('insert into Users (username, about, isAnonymous, name, email) values (?,?,?,?,?);',
		[newUser.username, newUser.about, newUser.isAnonymous, newUser.name, newUser.email]);
	let fromPost = yield connection.query('select  about, email, id, isAnonymous, name, username from ' +
		'Users where email = ?', [newUser.email]);
	let information = {
		code: 0,
		response: fromPost
	};
	this.body = information;
});



//THREAD


router.post('/thread/close', function *(){
	let closeThread = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('update Threads set isClosed = true where id = ?;',[closeThread.thread]);
	let fromThread = yield connection.query('select id from Threads where id = ?', [closeThread.thread]);
	let information = {
		code: 0,
		response: fromThread[0].id
	};
	this.body = information;
});


router.post('/thread/create', function *() {
	let newThread = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('insert into Threads (forum, title, isClosed, user, date, message, slug, isDeleted) values (?,?,?,?,?,?,?,?);',
		[newThread.forum, newThread.title, newThread.isClosed, newThread.user, newThread.date,
			newThread.message, newThread.slug, newThread.isDeleted]);
	let fromThread = yield connection.query('select  date, forum, id, isClosed, isDeleted, message, slug,' +
		'title,user from Threads where title = ? and date = ? and message = ?',
		[newThread.title, newThread.date, newThread.message]);
	let information = {
		code: 0,
		response: fromThread
	};
	this.body = information;
});

router.get('/thread/details/', function *(){
	let threadId = this.query.thread;
	let moreInfo = this.query.related || [];
	let connection = yield mysql.getConnection();
	let threadBuffer = yield connection.query('select likes, dislikes from Threads where id = ?;',[threadId]);
	let threadInfo = yield connection.query('select date, dislikes, forum, id, isClosed, isDeleted, likes,' +
			'message, likes - dislikes as points, posts, slug ,title,user from Threads where id = ?;', [threadId]);
	for(let i = 0; i < moreInfo.length;++i ){
		switch (moreInfo[i]) {
			case 'user':
				for(let j = 0; j < ThreadInfo.length; ++j){
					userInfo = yield connection.query('select * from Users where email = ?;', [threadInfo[j].user]);
					threadInfo[j].user = userInfo[0];
				}
				break;
			case 'forum':
				for(let j = 0;j < ThreadInfo.length; ++j){
					forumInfo = yield connection.query('select * from Forums where short_name = ?;', [threadInfo[j].forum]);
					threadInfo[j].forum = forumInfo[0];
				}
				break;
		}
	}
	let information = {
		code: 0,
		response: threadInfo
	};
	this.body = information;
});

router.get('/thread/list', function *(){
	let threadData = this.query.since || '0000-00-00 00:00:00';
	let threadSort = this.query.order || 'desc';
	let limit = this.query.limit || -1;
	let threadUser = this.query.user || false;
	let threadForum = this.query.forum || false;
	let threadInfo = {};
	let connection = yield mysql.getConnection();
	if(threadUser == false) {
		if(limit === -1) {
			threadInfo = yield connection.query('select date, dislikes, forum, id, isClosed, isDeleted, likes,' +
				'message,likes - dislikes as points, posts, slug ,title,user from Threads where forum = ? and date >= ? order by date ?;',
				[threadForum, threadData, threadSort]);
		} else {
			threadInfo = yield connection.query('select date, dislikes, forum, id, isClosed, isDeleted, likes,' +
				'message,likes - dislikes as points, posts, slug ,title,user from Threads where forum = ? and date >= ? ' +
				'order by date ? limit ?;',	[threadForum, threadData, threadSort, +limit]);
		}
	} else {
		if(limit === -1)
		threadInfo = yield connection.query('select date, dislikes, forum, id, isClosed, isDeleted, likes,' +
			'message,likes - dislikes as points, posts, slug ,title,user from Threads where user = ?and date >= ?' +
			' order by date ? limit ?;',
			[threadForum, threadData, threadSort, +limit]);

	}
	let information = {
		code: 0,
		response: threadInfo
	};
	this.body = information;
});


router.get('/thread/listPosts/', function *(){
	let threadData = this.query.since || '0000-00-00 00:00:00';
	let threadSort = this.query.order || 'desc';
	let threadId = this.query.thread;
	let limit = this.query.limit || -1;
	console.log(threadId,threadData, threadSort);
	let threadInfo = {};
	let connection = yield mysql.getConnection();
	if(limit === -1) {
		threadInfo = yield connection.query('select date, dislikes, forum, id, isApproved, isDeleted,' +
			'isEdited, isHighlighted, isSpam, likes, message, parent, likes - dislikes as points, thread, user ' +
			'from Posts where thread = ? and date >= ? order by date ?;',
			[threadId, threadData, threadSort]);
	} else {
		threadInfo = yield connection.query('select date, dislikes, forum, id, isApproved, isDeleted,' +
			'isEdited, isHighlighted, isSpam, likes, message, parent, likes - dislikes as points, thread, user ' +
			'from Posts where thread = ? and date >= ? order by date ? limit ?;',
			[threadId, threadData, threadSort, +limit]);
	}
	let information = {
		code: 0,
		response: threadInfo
	};
	this.body = information;
});

router.post('/thread/open', function *(){
	let idThread = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('update Threads set isClosed = 0 where id = ?;', [idThread.thread]);
	let information = {
		code: 0,
		response: idThread
	};
	this.body = information;
});

router.post('/thread/remove', function *(){
	let idThread = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('update Threads set isDeleted = 1 where id = ?;', [idThread.thread]);
	let information = {
		code: 0,
		response: idThread
	};
	this.body = information;
});

router.post('/thread/restore', function *(){
	let idThread = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('update Threads set isDeleted = 0 where id = ?;', [idThread.thread]);
	let information = {
		code: 0,
		response: idThread
	};
	this.body = information;
});

router.post('/thread/subscribe', function *(){
	let info = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('insert into Subscriptions (thread,user) values (?,?);', [info.thread, info.user]);
	let information = {
		code: 0,
		response: info
	};
	this.body = information;
});

router.post('/thread/unsubscribe', function *(){
	let info = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('delete from Subscriptions where thread = ? and user = ?;', [info.thread, info.user]);
	let information = {
		code: 0,
		response: info
	};
	this.body = information;
});

router.post('/thread/update', function *(){
	let info = this.request.body;
	let connection = yield mysql.getConnection();
	yield  connection.query('update Threads set message = ? where id = ?;', [info.message, info.thread]);
	yield  connection.query('update Threads set slug = ? where id = ?;', [info.slug, info.thread]);
	let information = {
		code: 0,
		response: yield connection.query('select date, dislikes, forum, id, isClosed, isDeleted, likes,' +
			'message,likes - dislikes as points, posts, slug ,title,user from Threads ' +
			'where id = ?;',
		[info.thread])
	};
	this.body = information;
});

router.post('/thread/vote', function *(){
	let info = this.request.body;
	let connection = yield mysql.getConnection();
	if(info.vote === 1){
		let likes = yield connection.query('select likes from Threads where id = ?;', [info.thread]);
		++likes[0].likes;
		yield connection.query('update Threads set likes = ? where id = ?;', [likes[0].likes, info.thread]);
	} else {
		let dislikes = yield connection.query('select dislikes from Threads where id = ?;', [info.thread]);
		++dislikes[0].dislikes;
		yield connection.query('update Threads set dislikes = ? where id = ?;', [dislikes[0].dislikes, info.thread]);
	}
	let information = {
		code: 0,
		response: yield connection.query('select date, dislikes, forum, id, isClosed, isDeleted, likes,' +
			'message,likes - dislikes as points, posts, slug ,title,user from Threads ' +
			'where id = ?;', [info.thread])
	};
	this.body = information;
});


app.use(logger());
app.use(koaBody);
app.use(router.routes());
app.use(router.allowedMethods());

app.listen(4000, () => {
	console.log('server listen port 4000');
	console.log(`go to http://localhost:4000/`);
});


