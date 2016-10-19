const koa = require('koa');
const app = koa();

const router = require('koa-router')();
const route = require('koa-route');
const moment = require('moment');
const koaBody = require('koa-body')();
const logger = require('koa-logger');
const mysql = require('./mysql');

router.get('/db/api/status', function *() {
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

router.post('/db/api/clear/', function *() {
	let connection = yield mysql.getConnection();
	yield connection.query('delete from Subscriptions;');
	yield connection.query('delete from Followers;');
	yield connection.query('delete from Forums;');
	yield connection.query('delete from Users;');
	yield connection.query('delete from Threads;');
	yield connection.query('delete from Posts;');
	let information = {
		code: 0,
		response: "OK"
	};
	this.body = information;
});

//FORUM

router.post('/db/api/forum/create', function *() {
	let newForum = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('insert into Forums (name, short_name, user) values (?,?,?);', [newForum.name, newForum.short_name, newForum.user]);
	let fromForum = yield connection.query('select * from Forums where short_name = ?;', [newForum.short_name]);
	let information = {
		code: 0,
		response: fromForum[0]
	};
	this.body = information;
});

router.get('/db/api/forum/details', function *() {
	let forum = this.query.forum;
	let moreInfo = this.query.related || '';
	let connection = yield mysql.getConnection();
	let forumId = yield connection.query('select * from Forums where short_name = ?;', [forum]);
	if (moreInfo === 'user') {
		let user = yield connection.query('select * from Users where email = ?;', [forumId[0].user]);
		let follower = yield connection.query('select follower from Followers where followee = ?;', [forumId[0].user]);
		let followee = yield  connection.query('select followee from Followers where follower = ?;', [forumId[0].user]);
		let subcriptions = yield connection.query('select * from Subscriptions where user = ?;', [forumId[0].user]);
		follower.forEach(function (item, i) {
			user[0].followers[i] = item.follower;
		});

		followee.forEach(function (item, i) {
			user[0].following[i] = item.followee;
		});
		subcriptions.forEach(function (item, i) {
			user[0].subscriptions[i] = item.thread;
		});
		forumId[0].user = user[0];
	}
	let information = {
		code: 0,
		response: forumId[0]
	};
	this.body = information;
});

router.get('/db/api/forum/listPosts', function *() {
	let forum = this.query.forum;
	let forumData = this.query.since || '0000-00-00 00:00:00';
	let forumSort = this.query.order || 'desc';
	let limit = this.query.limit || -1;
	let moreInfo = this.query.related || [];
	if (typeof moreInfo === 'string') {
		moreInfo = moreInfo.split();
	}
	let connection = yield mysql.getConnection();
	let threadInfo = {};
	let userInfo = {};
	let forumInfo = {};
	let PostInfo;
	if (limit === -1) {
		if(forumSort === 'desc') {
			PostInfo = yield connection.query('select date, dislikes, forum, id, isApproved, isDeleted,isEdited, isHighlighted, ' +
				'isSpam, likes , message, parent, likes - dislikes as points, thread, user from Posts where forum = ?' +
				'and date >= ? order by date desc ;', [forum, forumData]);
		} else {
			PostInfo = yield connection.query('select date, dislikes, forum, id, isApproved, isDeleted,isEdited, isHighlighted, ' +
				'isSpam, likes , message, parent, likes - dislikes as points, thread, user from Posts where forum = ?' +
				'and date >= ? order by date asc ;', [forum, forumData]);
		}
	} else {
		if(forumSort === 'desc') {
			PostInfo = yield connection.query('select date, dislikes, forum, id, isApproved, isDeleted,isEdited, isHighlighted, ' +
				'isSpam, likes , message, parent, likes - dislikes as points, thread, user from Posts where forum = ?' +
				'and date >= ? order by date desc limit ?;', [forum, forumData, +limit]);
		} else {
			PostInfo = yield connection.query('select date, dislikes, forum, id, isApproved, isDeleted,isEdited, isHighlighted, ' +
				'isSpam, likes , message, parent, likes - dislikes as points, thread, user from Posts where forum = ?' +
				'and date >= ? order by date asc limit ?;', [forum, forumData, +limit]);
		}
	}
	for(let j = 0; j < PostInfo.length; ++j){
		PostInfo[j].date = moment(PostInfo[j].date).format('YYYY-MM-DD HH:mm:ss').toString();
	}
	for (let i = 0; i < moreInfo.length; ++i) {
		switch (moreInfo[i]) {
			case 'thread':
				for (let j = 0; j < PostInfo.length; ++j) {
					threadInfo = yield connection.query('select date, dislikes, forum, id, isClosed, isDeleted, likes, ' +
						'message, likes - dislikes as points, posts, slug, title, user from Threads where id = ?;',
						[PostInfo[j].thread]);
					threadInfo[0].date = moment(threadInfo[0].date).format('YYYY-MM-DD HH:mm:ss').toString();
					PostInfo[j].thread = threadInfo[0];
				}
				break;
			case 'user':
				for (let j = 0; j < PostInfo.length; ++j) {
					userInfo = yield connection.query('select * from Users where email = ?;', [PostInfo[j].user]);
					PostInfo[j].user = userInfo[0];
				}
				break;
			case 'forum':
				for (let j = 0; j < PostInfo.length; ++j) {
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

router.get('/db/api/forum/listThreads', function *() {
	let forum = this.query.forum;
	let forumData = this.query.since || '0000-00-00 00:00:00';
	let forumSort = this.query.order || 'desc';
	let limit = this.query.limit || -1;
	let moreInfo = this.query.related || [];
	console.log(moreInfo);
	if (typeof moreInfo === 'string') {
		moreInfo = moreInfo.split(' ');
		console.log(typeof moreInfo, moreInfo);
	}
	let connection = yield mysql.getConnection();
	let forumInfo;
	let threadInfo;
	if (limit === -1) {
		threadInfo = yield connection.query('select date, dislikes, id, isClosed, isDeleted, likes, message, likes - dislikes as points, ' +
			'posts, slug, title, forum, user from Threads where forum = ?' +
			'and date >= ? order by date ' + forumSort + ';', [forum, forumData]);
	} else {
		threadInfo = yield connection.query('select date, dislikes, id, isClosed, isDeleted, likes, message, likes - dislikes as points, ' +
			'posts, slug, title, forum, user from Threads where forum = ?' +
			'and date >= ? order by date ' + forumSort + '  limit ?;', [forum, forumData, +limit]);

	}
	for (let k = 0; k < threadInfo.length; ++k) {
		threadInfo[k].date = moment(threadInfo[k].date).format('YYYY-MM-DD HH:mm:ss').toString();
	}
	let userInfo;
	for (let i = 0; i < moreInfo.length; ++i) {
		switch (moreInfo[i]) {
			case 'user':
				console.log('looooool');
				for (let j = 0; j < threadInfo.length; ++j) {
					userInfo = yield connection.query('select * from Users where email = ?;', [threadInfo[j].user]);
					let follower = yield connection.query('select follower from Followers where followee = ?;', [userInfo[0].email]);
					let followee = yield  connection.query('select followee from Followers where follower = ?;', [userInfo[0].email]);
					let subcriptions = yield connection.query('select thread from Subscriptions where user = ?;', [userInfo[0].email]);
					if (follower.length !== 0) {
						follower.forEach(function (item, j) {
							userInfo[0].followers[j] = item.follower;
						});
					} else {
						userInfo[0].followers = [];
					}
					if (followee.length !== 0) {
						followee.forEach(function (item, j) {
							userInfo[0].following[j] = item.followee;
						});
					} else {
						userInfo[0].following = [];
					}
					userInfo[0].subscriptions = [];
					if (subcriptions.length !== 0) {
						subcriptions.forEach(function (item, j) {
							userInfo[0].subscriptions[j] = item.thread;
						});
					}

					threadInfo[j].user = userInfo[0];
				}
				break;
			case 'forum':
				console.log('looooool');
				for (let j = 0; j < threadInfo.length; ++j) {
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

router.get('/db/api/forum/listUsers', function *() {
	let forum = this.query.forum;
	let forumSort = this.query.order || 'desc';
	let connection = yield mysql.getConnection();
	let limit = this.query.limit || -1;
	let since_id = this.query.since_id || 0;
	let user;
	if (limit === -1) {
		if (forumSort === 'asc') {
			user = yield connection.query('select about, email, Users.id, isAnonymous, Users.name, username from Users inner join ' +
				' Posts on Users.email = Posts.user where forum = ? and Users.id >= ? group by Posts.user order by Users.name asc;', [forum, since_id]);
		} else {
			user = yield connection.query('select about, email, Users.id, isAnonymous, Users.name, username from Users inner join ' +
				' Posts on Users.email = Posts.user where forum = ? and Users.id >= ? group by Posts.user order by Users.name desc;', [forum, since_id]);
		}
	} else {
		if (forumSort === 'asc') {
			user = yield connection.query('select about, email, Users.id, isAnonymous, Users.name, username from Users inner join ' +
				' Posts on Users.email = Posts.user where forum = ? and Users.id >= ? group by Posts.user order by Users.name asc limit ?;',
				[forum, since_id, +limit]);
		} else {
			user = yield connection.query('select about, email, Users.id, isAnonymous, Users.name, username from Users inner join ' +
				' Posts on Users.email = Posts.user where forum = ? and Users.id >= ? group by Posts.user order by Users.name desc limit ?;',
				[forum,since_id, +limit]);
		}
	}
	for (let i = 0; i < user.length; ++i) {
		console.log(user[i].email);
		let follower = yield connection.query('select follower from Followers where followee = ?;', [user[i].email]);
		let followee = yield  connection.query('select followee from Followers where follower = ?;', [user[i].email]);
		let subcriptions = yield connection.query('select thread from Subscriptions where user = ?;', [user[i].email]);
		if(follower.length !== 0) {
			follower.forEach(function (item, j) {
				user[i].followers[j] = item.follower;
			});
		} else {
			user[i].followers = [];
		}
		if(followee.length !== 0) {
			followee.forEach(function (item, j) {
				user[i].following[j] = item.followee;
			});
		} else {
			user[i].following = [];
		}
		user[i].subscriptions = [];
		if(subcriptions.length !== 0) {
			subcriptions.forEach(function (item, j) {
				user[i].subscriptions[j] = item.thread;
			});
		}

	}
	let information = {
		code: 0,
		response: user
	};
	this.body = information;
});


//POSTco


router.post('/db/api/post/create', function *() {
	let newPost = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('insert into Posts (isApproved, user, date, message, isSpam, isHighlighted, thread, forum, ' +
		'isDeleted, isEdited, parent) values (?,?,?,?,?,?,?,?,?,?,?);',
		[newPost.isApproved, newPost.user, newPost.date, newPost.message, newPost.isSpam,
			newPost.isHighlighted, newPost.thread, newPost.forum,
			newPost.isDeleted, newPost.isEdited, newPost.parent]);
	let numOfPost = yield connection.query('select posts from Threads where id = ?', newPost.thread);
	++numOfPost[0].posts;
	yield connection.query('update Threads set posts = ? where id = ?;', [numOfPost[0].posts, newPost.thread]);
	let fromPost = yield connection.query('select date, forum,	id,	isApproved, isDeleted, isEdited, isHighlighted, ' +
		'isSpam, message, parent, thread, user from Posts where message = ? and date = ?', [newPost.message, newPost.date]);
	let information = {
		code: 0,
		response: fromPost[0]
	};
	this.body = information;
});

router.get('/db/api/post/details/', function *() {
	let postId = this.query.post;
	let moreInfo = this.query.related || [];
	if (typeof moreInfo === 'string') {
		moreInfo = moreInfo.split();
	}
	if (postId <= 0) {
		let information = {
			code: 1,
			response: {}
		};
		this.body = information;
	} else {
		let connection = yield mysql.getConnection();
		let post = yield connection.query('select date, dislikes, forum, id, isApproved, isDeleted, isEdited, ' +
			'isHighlighted, isSpam, likes, message, parent, likes - dislikes as points, thread, user from Posts where id = ?', [postId]);
		post[0].date = moment(post[0].date).format('YYYY-MM-DD HH:mm:ss').toString();
		for (let i = 0; i < moreInfo.length; ++i) {
			switch (moreInfo[i]) {
				case 'thread':
					threadInfo = yield connection.query('select date, dislikes, forum, id, isClosed, isDeleted, likes, ' +
						'message, likes - dislikes as points, posts, slug, title, user from Threads where id = ?;',
						[post[0].thread]);
					threadInfo[0].date = moment(threadInfo[0].date).format('YYYY-MM-DD HH:mm:ss').toString();
					post[0].thread = threadInfo[0];
					break;
				case 'user':
					userInfo = yield connection.query('select * from Users where email = ?;', [post[0].user]);
					post[0].user = userInfo[0];
					break;
				case 'forum':
					forumInfo = yield connection.query('select * from Forums where short_name = ?;', [post[0].forum]);
					post[0].forum = forumInfo[0];
					break;
			}
		}
		let information = {
			code: 0,
			response: post[0]
		};
		this.body = information;
	}
});

router.get('/db/api/post/list/', function *() {
	let forum = this.query.forum || '';
	let threadId = this.query.thread || '';
	let sort = this.query.order || 'desc';
	let limit = this.query.limit || -1;
	let data = this.query.since || '0000-00-00 00:00:00';
	let connection = yield mysql.getConnection();
	let postList = {};
	if (threadId === '') {
		if (limit === -1) {
			postList = yield connection.query('select date, dislikes, forum, id, isApproved, isDeleted, isEdited, ' +
				'isHighlighted, isSpam, likes, message, parent, likes - dislikes as points, thread, user from Posts where ' +
				'forum = ? and date >= ? order by date ' + sort + ';', [forum, data]);
		} else {
			postList = yield connection.query('select date, dislikes, forum, id, isApproved, isDeleted, isEdited, ' +
				'isHighlighted, isSpam, likes, message, parent, likes - dislikes as points, thread, user from Posts where ' +
				'forum = ? and date >= ? order by date ' + sort + ' limit ?;', [forum, data, +limit]);
		}
	} else {
		if (limit === -1) {
			postList = yield connection.query('select date, dislikes, forum, id, isApproved, isDeleted, isEdited, ' +
				'isHighlighted, isSpam, likes, message, parent, likes - dislikes as points, thread, user from Posts where ' +
				'thread = ? and date >= ? order by date ' + sort + ';', [threadId, data]);
		} else {
			postList = yield connection.query('select date, dislikes, forum, id, isApproved, isDeleted, isEdited, ' +
				'isHighlighted, isSpam, likes, message, parent, likes - dislikes as points, thread, user from Posts where ' +
				'thread = ? and date >= ? order by date ' + sort + ' limit ?;', [threadId, data, +limit]);
		}
	}
	for (let i = 0; i < postList.length; ++i) {
		postList[i].date = moment(postList[i].date).format('YYYY-MM-DD HH:mm:ss').toString();
	}
	let information = {
		code: 0,
		response: postList
	};
	this.body = information;
});

router.post('/db/api/post/remove/', function *() {
	let post = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('update Posts set isDeleted = ? where id = ?;', [true, post.post]);
	let thread = yield connection.query('select thread from Posts where id = ?', [post.post]);
	let numOfPost = yield connection.query('select posts from Threads where id = ?', [thread[0].thread]);
	--numOfPost[0].posts;
	yield connection.query('update Threads set posts = ? where id = ?;', [numOfPost[0].posts, thread[0].thread]);
	let information = {
		code: 0,
		response: post
	};
	this.body = information;
});

router.post('/db/api/post/restore/', function *() {
	let post = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('update Posts set isDeleted = ? where id = ?;', [false, post.post]);
	let thread = yield connection.query('select thread from Posts where id = ?', [post.post]);
	let numOfPost = yield connection.query('select posts from Threads where id = ?', [thread[0].thread]);
	++numOfPost[0].posts;
	yield connection.query('update Threads set posts = ? where id = ?;', [numOfPost[0].posts, thread[0].thread]);
	let information = {
		code: 0,
		response: post
	};
	this.body = information;
});

router.post('/db/api/post/update/', function *() {
	let post = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('update Posts set message = ? where id = ?', [post.message, post.post]);
	let postInfo = yield connection.query('select date, dislikes, forum, id, isApproved, isDeleted, isEdited, ' +
		'isHighlighted, isSpam, likes, message, parent, likes - dislikes as points, thread, user from Posts where id = ?',
		[post.post]);
	let information = {
		code: 0,
		response: postInfo
	};
	this.body = information;
});

router.post('/db/api/post/vote/', function *() {
	let info = this.request.body;
	let connection = yield mysql.getConnection();
	let code, response;
	if (info.vote === 1) {
		let likes = yield connection.query('select likes from Posts where id = ?;', [info.post]);
		if (likes.length === 0) {
			code = 1;
			response = {};
		} else {
			++likes[0].likes;
			console.log(likes[0].likes);
			yield connection.query('update Posts set likes = ? where id = ?;', [likes[0].likes, info.post]);
			code = 0;
			response = yield connection.query('select date, dislikes, forum, id, isApproved, isDeleted, isEdited, isHighlighted' +
				' isSpam, likes, message, parent, likes - dislikes as points, thread, user from Posts where id = ?;',
				[info.post]);
		}
	} else {
		let dislikes = yield connection.query('select dislikes from Posts where id = ?;', [info.post]);
		if (dislikes.length === 0) {
			code = 1;
			response = {};
		} else {
			++dislikes[0].dislikes;
			yield connection.query('update Posts set dislikes = ? where id = ?;', [dislikes[0].dislikes, info.post]);
			code = 0;
			response = yield connection.query('select date, dislikes, forum, id, isApproved, isDeleted, isEdited, isHighlighted' +
				' isSpam, likes, message, parent, likes - dislikes as points, thread, user from Posts where id = ?;', [info.post]);
		}
	}
	let information = {
		code: code,
		response: response
	};
	this.body = information;
});

//USERS


router.post('/db/api/user/create', function *() {
	let newUser = this.request.body;
	let connection = yield mysql.getConnection();
	let result = yield connection.query('select name from Users where email = ?', [newUser.email]);
	if (result.length !== 0) {
		let information = {
			code: 5,
			response: {}
		};
		this.body = information;
	} else {
		yield connection.query('insert into Users (username, about, isAnonymous, name, email) values (?,?,?,?,?);',
			[newUser.username, newUser.about, newUser.isAnonymous, newUser.name, newUser.email]);
		let fromPost = yield connection.query('select  about, email, id, isAnonymous, name, username from ' +
			'Users where email = ?', [newUser.email]);
		let information = {
			code: 0,
			response: fromPost[0]
		};
		this.body = information;
	}
});

router.get('/db/api/user/details/', function *() {
	let email = this.query.user;
	let connection = yield mysql.getConnection();
	let user = yield connection.query('select * from Users where email = ?;', [email]);
	let follower = yield connection.query('select follower from Followers where followee = ?;', [email]);
	let followee = yield  connection.query('select followee from Followers where follower = ?;', [email]);
	let subcriptions = yield connection.query('select thread from Subscriptions where user = ?;', [email]);
	user[0].followers = [];
	user[0].following = [];
	user[0].subscriptions = [];
	if (follower !== []) {
		follower.forEach(function (item, i) {
			user[0].followers[i] = item.follower;
		});
	}
	if (followee !== []) {
		followee.forEach(function (item, i) {
			user[0].following[i] = item.followee;
		});
	}
	if (subcriptions !== []) {
		subcriptions.forEach(function (item, i) {
			user[0].subscriptions[i] = item.thread;
		});
	}
	let information = {
		code: 0,
		response: user[0]
	};
	this.body = information;
});

router.post('/db/api/user/follow', function *() {
	let info = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('insert into Followers (followee, follower) values (?,?);', [info.followee, info.follower]);
	let user = yield connection.query('select * from Users where email = ?;', [info.follower]);
	let follower = yield connection.query('select follower from Followers where followee = ?;', [info.follower]);
	let followee = yield  connection.query('select followee from Followers where follower = ?;', [info.follower]);
	let subcriptions = yield connection.query('select thread from Subscriptions where user = ?;', [info.follower]);
	user[0].followers = [];
	user[0].following = [];
	user[0].subscriptions = [];
	follower.forEach(function (item, i) {
		user[0].followers[i] = item.follower;
	});

	followee.forEach(function (item, i) {
		user[0].following[i] = item.followee;
	});
	subcriptions.forEach(function (item, i) {
		user[0].subscriptions[i] = item.thread;
	});
	let information = {
		code: 0,
		response: user
	};
	this.body = information;
});

router.get('/db/api/user/listFollowers', function *() {
	let email = this.query.user;
	let order = this.query.order || 'desc';
	let limit = this.query.limit || -1;
	let since = this.query.since_id || 0;
	let connection = yield mysql.getConnection();
	let users;
	if (order === 'desc') {
		if (limit === -1) {
			users = yield connection.query('select follower from Followers join Users on Followers.followee = Users.email' +
				' where followee = ? and id > ? order by follower desc;', [email, since]);
		} else {
			users = yield connection.query('select follower from Followers join Users on Followers.followee = Users.email' +
				' where followee = ? and id > ? order by follower desc limit ?;', [email, since, +limit]);
		}
	} else {
		if (limit === -1) {
			users = yield connection.query('select follower from Followers join Users on Followers.followee = Users.email' +
				' where followee = ? and id > ? order by follower asc;', [email, since]);
		} else {
			users = yield connection.query('select follower from Followers join Users on Followers.followee = Users.email' +
				' where followee = ? and id > ? order by follower asc limit ?;', [email, since, +limit]);
		}
	}
	for (let i = 0; i < users.length; ++i) {
		let info = yield connection.query('select * from Users where email = ?', [users[i].follower]);
		let follower = yield connection.query('select follower from Followers where followee = ?;', [users[i].follower]);
		let followee = yield connection.query('select followee from Followers where follower = ?;', [users[i].follower]);
		let subcriptions = yield connection.query('select thread from Subscriptions where user = ?;', [users[i].follower]);
		info[0].followers = [];
		info[0].following = [];
		info[0].subscriptions = [];
		follower.forEach(function (item, i) {
			info[0].followers[i] = item.follower;
		});
		followee.forEach(function (item, i) {
			info[0].following[i] = item.followee;
		});
		subcriptions.forEach(function (item, i) {
			info[0].subscriptions[i] = item.thread;
		});
		users[i] = info[0];
	}
	let information = {
		code: 0,
		response: users
	};
	this.body = information;
});

router.get('/db/api/user/listFollowing', function *() {
	let email = this.query.user;
	let order = this.query.order || 'desc';
	let limit = this.query.limit || -1;
	let since = this.query.since_id || 0;
	let connection = yield mysql.getConnection();
	let users;
	if (order === 'desc') {
		if (limit === -1) {
			users = yield connection.query('select followee from Followers join Users on Followers.follower = Users.email' +
				' where follower = ? and id > ? order by followee desc;', [email, since]);
		} else {
			users = yield connection.query('select followee from Followers join Users on Followers.follower = Users.email' +
				' where follower = ? and id > ? order by followee desc limit ?;', [email, since, +limit]);
		}
	} else {
		if (limit === -1) {
			users = yield connection.query('select followee from Followers join Users on Followers.follower = Users.email' +
				' where follower = ? and id > ? order by followee asc;', [email, since]);
		} else {
			users = yield connection.query('select followee from Followers join Users on Followers.follower = Users.email' +
				' where follower = ? and id > ? order by followee asc limit ?;', [email, since, +limit]);
		}
	}
	for (let i = 0; i < users.length; ++i) {
		let info = yield connection.query('select * from Users where email = ?', [users[i].followee]);
		let follower = yield connection.query('select follower from Followers where followee = ?;', [users[i].followee]);
		let followee = yield connection.query('select followee from Followers where follower = ?;', [users[i].followee]);
		let subcriptions = yield connection.query('select thread from Subscriptions where user = ?;', [users[i].followee]);
		info[0].followers = [];
		info[0].following = [];
		info[0].subscriptions = [];
		follower.forEach(function (item, i) {
			info[0].followers[i] = item.follower;
		});
		followee.forEach(function (item, i) {
			info[0].following[i] = item.followee;
		});
		subcriptions.forEach(function (item, i) {
			info[0].subscriptions[i] = item.thread;
		});
		users[i] = info[0];
	}
	let information = {
		code: 0,
		response: users
	};
	this.body = information;
});

router.get('/db/api/user/listPosts/', function *() {
	let email = this.query.user;
	let order = this.query.order || 'desc';
	let limit = this.query.limit || -1;
	let data = this.query.data || '0000-00-00 00:00:00';
	let connection = yield mysql.getConnection();
	let posts;
	if (limit === -1) {
		posts = yield connection.query('select date, dislikes, forum, id, isApproved, isDeleted, isEdited, isHighlighted,' +
			' isSpam, likes, message, parent, likes - dislikes as points, thread, user from Posts where user = ? and date >= ?' +
			' order by date ' + order + ';', [email, data]);
	} else {
		posts = yield connection.query('select date, dislikes, forum, id, isApproved, isDeleted, isEdited, isHighlighted,' +
			' isSpam, likes, message, parent, likes - dislikes as points, thread, user from Posts where user = ? and date >= ?' +
			' order by date ' + order + ' limit ?;', [email, data, +limit]);
	}
	for (let i = 0; i < posts.length; ++i) {
		posts[i].date = moment(posts[i].date).format('YYYY-MM-DD HH:mm:ss').toString();
	}
	let information = {
		code: 0,
		response: posts
	};
	this.body = information;
});

router.post('/db/api/user/unfollow', function *() {
	let info = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('delete from Followers where followee = ? and follower = ?', [info.followee, info.follower]);
	let user = yield connection.query('select * from Users where email = ?', [info.follower]);
	let follower = yield connection.query('select follower from Followers where followee = ?;', [info.follower]);
	let followee = yield connection.query('select followee from Followers where follower = ?;', [info.follower]);
	let subcriptions = yield connection.query('select thread from Subscriptions where user = ?;', [info.follower]);
	user[0].followers = [];
	user[0].following = [];
	user[0].subscriptions = [];
	follower.forEach(function (item, i) {
		user[0].followers[i] = item.follower;
	});
	followee.forEach(function (item, i) {
		user[0].following[i] = item.followee;
	});
	subcriptions.forEach(function (item, i) {
		user[0].subscriptions[i] = item.thread;
	});
	let information = {
		code: 0,
		response: user[0]
	};
	this.body = information;
})

router.post('/db/api/user/updateProfile/', function *() {
	let info = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('update Users set about = ? where email = ?', [info.about, info.user]);
	yield connection.query('update Users set name = ? where email = ?', [info.name, info.user]);
	let user = yield connection.query('select * from Users where email = ?', [info.user]);
	let follower = yield connection.query('select follower from Followers where followee = ?;', [info.user]);
	let followee = yield connection.query('select followee from Followers where follower = ?;', [info.user]);
	let subcriptions = yield connection.query('select thread from Subscriptions where user = ?;', [info.user]);
	user[0].followers = [];
	user[0].following = [];
	user[0].subscriptions = [];
	follower.forEach(function (item, i) {
		user[0].followers[i] = item.follower;
	});
	followee.forEach(function (item, i) {
		user[0].following[i] = item.followee;
	});
	subcriptions.forEach(function (item, i) {
		user[0].subscriptions[i] = item.thread;
	});
	let information = {
		code: 0,
		response: user[0]
	};
	this.body = information;
});
//THREAD


router.post('/db/api/thread/close', function *() {
	let closeThread = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('update Threads set isClosed = true where id = ?;', [closeThread.thread]);
	let fromThread = yield connection.query('select id from Threads where id = ?', [closeThread.thread]);
	let information = {
		code: 0,
		response: fromThread[0].id
	};
	this.body = information;
});


router.post('/db/api/thread/create', function *() {
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
		response: fromThread[0]
	};
	this.body = information;
});

router.get('/db/api/thread/details/', function *() {
	let threadId = this.query.thread;
	let moreInfo = this.query.related || [];
	if (typeof moreInfo === 'string') {
		moreInfo.split();
	}
	let connection = yield mysql.getConnection();
	let threadInfo = yield connection.query('select date, dislikes, forum, id, isClosed, isDeleted, likes,' +
		'message, likes - dislikes as points, posts, slug ,title,user from Threads where id = ?;', [threadId]);
	let thread = false;
	for (let i = 0; i < moreInfo.length; ++i) {
		if (moreInfo[i] === 'thread') {
			thread = true;
		}
	}
	if (threadInfo.length === 0 || thread) {
		let information = {
			code: 3,
			response: {}
		};
		this.body = information;
	} else {
		threadInfo[0].date = moment(threadInfo[0].date).format('YYYY-MM-DD HH:mm:ss').toString();
		for (let i = 0; i < moreInfo.length; ++i) {
			switch (moreInfo[i]) {
				case 'user':
					for (let j = 0; j < threadInfo.length; ++j) {
						userInfo = yield connection.query('select * from Users where email = ?;', [threadInfo[j].user]);
						threadInfo[j].user = userInfo[0];
					}
					break;
				case 'forum':
					for (let j = 0; j < threadInfo.length; ++j) {
						forumInfo = yield connection.query('select * from Forums where short_name = ?;', [threadInfo[j].forum]);
						threadInfo[j].forum = forumInfo[0];
					}
					break;
			}
		}
		let information = {
			code: 0,
			response: threadInfo[0]
		};
		this.body = information;
	}
});

router.get('/db/api/thread/list', function *() {
	let threadData = this.query.since || '0000-00-00 00:00:00';
	let order = this.query.order || 'desc';
	let limit = this.query.limit || -1;
	let threadUser = this.query.user || false;
	let threadForum = this.query.forum || false;
	let threadInfo = {};
	let connection = yield mysql.getConnection();
	if (!threadUser) {
		if (limit === -1) {
			if (order === 'desc') {
				threadInfo = yield connection.query('select Threads.date, Threads.dislikes, Threads.forum, Threads.id, ' +
					'Threads.isClosed, Threads.isDeleted, Threads.likes, Threads.message, Threads.likes - Threads.dislikes as ' +
					'points, Threads.posts, Threads.slug, Threads.title, Threads.user from Threads right join Forums on Threads.slug = ' +
					' Forums.short_name where Forums.short_name = ? and date >= ? ' +
					'order by date desc;', [threadForum, threadData]);
			} else {
				threadInfo = yield connection.query('select Threads.date, Threads.dislikes, Threads.forum, Threads.id, ' +
					'Threads.isClosed, Threads.isDeleted, Threads.likes, Threads.message, Threads.likes - Threads.dislikes as ' +
					'points, Threads.posts, Threads.slug ,Threads.title,Threads.user from Threads right join Forums on Threads.slug = ' +
					' Forums.short_name where Forums.short_name = ? and date >= ? ' +
					'order by date asc;', [threadForum, threadData]);
			}
		} else {
			if (order === 'desc') {
				threadInfo = yield connection.query('select Threads.date, Threads.dislikes, Threads.forum, Threads.id, ' +
					'Threads.isClosed, Threads.isDeleted, Threads.likes, Threads.message, Threads.likes - Threads.dislikes as ' +
					'points, Threads.posts, Threads.slug ,Threads.title,Threads.user from Threads right join Forums on Threads.slug = ' +
					' Forums.short_name where Forums.short_name = ? and date >= ? ' +
					'order by date desc limit ?;', [threadForum, threadData, +limit]);
			} else {
				threadInfo = yield connection.query('select Threads.date, Threads.dislikes, Threads.forum, Threads.id, Threads.isClosed,' +
					' Threads.isDeleted, Threads.likes, Threads.message,Threads.likes - Threads.dislikes as points,  Threads.posts, ' +
					'Threads.slug ,Threads.title,Threads.user from Threads right join Forums on Threads.slug = ' +
					' Forums.short_name where Forums.short_name = ? and date >= ? ' +
					'order by date asc limit ?;', [threadForum, threadData, +limit]);
			}
		}
	} else {
		if (limit === -1) {
			if (order === 'desc') {
				threadInfo = yield connection.query('select date, dislikes, forum, id, isClosed, isDeleted, likes,' +
					'message,likes - dislikes as points, posts, slug ,title,user from Threads where user = ? and date >= ? ' +
					'order by date desc;', [threadUser, threadData]);
			} else {
				threadInfo = yield connection.query('select date, dislikes, forum, id, isClosed, isDeleted, likes,' +
					'message,likes - dislikes as points, posts, slug ,title,user from Threads  where user ' +
					'= ? and date >= ? order by date asc;', [threadUser, threadData]);
			}
		} else {
			if (order === 'desc') {
				threadInfo = yield connection.query('select date, dislikes, forum, id, isClosed, isDeleted, likes,' +
					'message,likes - dislikes as points, posts, slug ,title,user from Threads where user = ? and date >= ? ' +
					'order by date desc limit ?;', [threadUser, threadData, +limit]);
			} else {
				threadInfo = yield connection.query('select date, dislikes, forum, id, isClosed, isDeleted, likes,' +
					'message,likes - dislikes as points, posts, slug ,title,user from Threads  where user = ? and date >= ? ' +
					'order by date asc limit ?;', [threadUser, threadData, +limit]);
			}
		}
	}
	for (let i = 0; i < threadInfo.length; ++i) {
		threadInfo[i].date = moment(threadInfo[i].date).format('YYYY-MM-DD HH:mm:ss').toString();
	}
	let information = {
		code: 0,
		response: threadInfo
	};
	this.body = information;
});


router.get('/db/api/thread/listPosts/', function *() {
	let threadData = this.query.since || '0000-00-00 00:00:00';
	let order = this.query.order || 'desc';
	let sort = this.query.sort || 'flat';
	let threadId = this.query.thread;
	let limit = this.query.limit || -1;
	let threadInfo = {};
	let connection = yield mysql.getConnection();
	let information;
	switch (sort){
		case 'flat' :
			if (limit === -1) {
				threadInfo = yield connection.query('select Posts.date, Posts.dislikes, Posts.forum, Posts.id, Posts.isApproved,' +
					' Posts.isDeleted, Posts.isEdited, Posts.isHighlighted, Posts.isSpam, Posts.likes, Posts.message, ' +
					'Posts.parent, Posts.likes - Posts.dislikes as points, Posts.thread, Posts.user from Posts right join ' +
					'Threads on Threads.id = Posts.thread where thread = ? and Threads.date >= ? order by Threads.date ' +
					order + ';', [threadId, threadData]);
			} else {
				threadInfo = yield connection.query('select Posts.date, Posts.dislikes, Posts.forum, Posts.id, Posts.isApproved,' +
					' Posts.isDeleted, Posts.isEdited, Posts.isHighlighted, Posts.isSpam, Posts.likes, Posts.message, ' +
					'Posts.parent, Posts.likes - Posts.dislikes as points, Posts.thread, Posts.user from Posts right join ' +
					'Threads on Threads.id = Posts.thread where thread = ? and Threads.date >= ? order by Threads.date ' +
					order + ' limit ?;', [threadId, threadData, +limit]);
			}
			for (let i = 0; i < threadInfo.length; ++i) {
				threadInfo[i].date = moment(threadInfo[i].date).format('YYYY-MM-DD HH:mm:ss').toString();
			}
			information = {
				code: 0,
				response: threadInfo
			};
			this.body = information;
			break;
		case 'tree' :
			if (limit === -1) {
				threadInfo = yield connection.query('select Posts.date, Posts.dislikes, Posts.forum, Posts.id, Posts.isApproved,' +
					' Posts.isDeleted, Posts.isEdited, Posts.isHighlighted, Posts.isSpam, Posts.likes, Posts.message, ' +
					'Posts.parent, Posts.likes - Posts.dislikes as points, Posts.thread, Posts.user from Posts right join ' +
					'Threads on Threads.id = Posts.thread where thread = ? and Threads.date >= ? order by ' +
					'Threads.id, Threads.date ' + order + ';',
					[threadId, threadData]);
			} else {
				threadInfo = yield connection.query('select Posts.date, Posts.dislikes, Posts.forum, Posts.id, Posts.isApproved,' +
					' Posts.isDeleted, Posts.isEdited, Posts.isHighlighted, Posts.isSpam, Posts.likes, Posts.message, ' +
					'Posts.parent, Posts.likes - Posts.dislikes as points, Posts.thread, Posts.user from Posts right join ' +
					'Threads on Threads.id = Posts.thread where thread = ? and Threads.date >= ? order by ' +
					'Threads.id, Threads.date ' + order + ' limit ?;',
					[threadId, threadData, +limit]);
			}
			for (let i = 0; i < threadInfo.length; ++i) {
				threadInfo[i].date = moment(threadInfo[i].date).format('YYYY-MM-DD HH:mm:ss').toString();
			}
			information = {
				code: 0,
				response: threadInfo
			};
			this.body = information;
			break;
		case 'parent_tree' :
			if (limit === -1) {
				threadInfo = yield connection.query('select Posts.date, Posts.dislikes, Posts.forum, Posts.id, Posts.isApproved,' +
					' Posts.isDeleted, Posts.isEdited, Posts.isHighlighted, Posts.isSpam, Posts.likes, Posts.message, Posts.parent,' +
					' Posts.likes - Posts.dislikes as points, Posts.thread, Posts.user from Posts right join Threads on ' +
					'Threads.id = Posts.thread where thread = ? and Threads.date >= ? order by Threads.id, Threads.date ' +
					order + ';', [threadId, threadData]);
			} else {
				let threads = yield connection.query('select id from Threads where date >= ? order by date ' + order +
					' limit ?;', [threadData, +limit]);
				threadInfo = [];
				for(let i = 0; i < threads.length; ++i) {
					threadInfo[i] = yield connection.query('select Posts.date, Posts.dislikes, Posts.forum, Posts.id, ' +
						'Posts.isApproved, Posts.isDeleted, Posts.isEdited, Posts.isHighlighted, Posts.isSpam, Posts.likes, ' +
						'Posts.message, Posts.parent, Posts.likes - Posts.dislikes as points, Posts.thread, Posts.user from ' +
						'Posts right join Threads on Threads.id = Posts.thread where thread = ? and Threads.date >= ? order by ' +
						'Threads.id, Threads.date ' + order + ';',
						[threadId, threadData]);
				}
			}
			for (let i = 0; i < threadInfo.length; ++i) {
				threadInfo[i].date = moment(threadInfo[i].date).format('YYYY-MM-DD HH:mm:ss').toString();
			}
			information = {
				code: 0,
				response: threadInfo
			};
			this.body = information;
			break;
	}
});

router.post('/db/api/thread/open', function *() {
	let idThread = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('update Threads set isClosed = ? where id = ?;', [false, idThread.thread]);
	let information = {
		code: 0,
		response: idThread
	};
	this.body = information;
});

router.post('/db/api/thread/remove', function *() {
	let idThread = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('update Threads set isDeleted = ? where id = ?;', [true, idThread.thread]);
	yield connection.query('update Threads set posts = 0 where id = ?;',[idThread.thread]);
	yield connection.query('update Posts set isDeleted = ? where thread = ?;', 	[true, idThread.thread]);
	let information = {
		code: 0,
		response: idThread
	};
	this.body = information;
});

router.post('/db/api/thread/restore', function *() {
	let idThread = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('update Threads set isDeleted = ? where id = ?;', [false, idThread.thread]);
	let count = yield connection.query('select count(id) from Posts where thread = ?', [idThread.thread]);
	yield connection.query('update Threads set posts = ? where id = ?', [count[0]['count(id)'], idThread.thread])
	yield connection.query('update Posts set isDeleted = ? where thread = ?;', [false, idThread.thread]);
	let information = {
		code: 0,
		response: idThread
	};
	this.body = information;
});

router.post('/db/api/thread/subscribe', function *() {
	let info = this.request.body;
	let connection = yield mysql.getConnection();
	let check = yield connection.query('select * from Subscriptions where thread = ? and user = ?', [info.thread, info.user]);
	if (check.length === 0) {
		yield connection.query('insert into Subscriptions (thread,user) values (?,?);', [info.thread, info.user]);
		let information = {
			code: 0,
			response: info
		};
		this.body = information;
	} else {
		let information = {
			code: 5,
			response: {}
		};
		this.body = information;
	}

});

router.post('/db/api/thread/unsubscribe', function *() {
	let info = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('delete from Subscriptions where thread = ? and user = ?;', [info.thread, info.user]);
	let information = {
		code: 0,
		response: info
	};
	this.body = information;
});

router.post('/db/api/thread/update', function *() {
	let info = this.request.body;
	let connection = yield mysql.getConnection();
	yield connection.query('update Threads set message = ? where id = ?;', [info.message, info.thread]);
	yield connection.query('update Threads set slug = ? where id = ?;', [info.slug, info.thread]);
	let information = {
		code: 0,
		response: yield connection.query('select date, dislikes, forum, id, isClosed, isDeleted, likes,' +
			'message,likes - dislikes as points, posts, slug ,title,user from Threads ' +
			'where id = ?;',
			[info.thread])
	};
	this.body = information;
});

router.post('/db/api/thread/vote', function *() {
	let info = this.request.body;
	let connection = yield mysql.getConnection();
	if (info.vote === 1) {
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
