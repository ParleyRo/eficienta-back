import { MongoClient } from 'mongodb';

class Database{

	static collection = {};

	constructor(dbName){

		this.dbName = dbName;

		this.client = new MongoClient('mongodb://127.0.0.1:27017/');
		
	}

	async connect(collection){

		if(this.constructor.collection[collection] != null){
			return this.constructor.collection[collection];
		}

		await this.client.connect();

		console.log('Connected successfully to server');
	
		this.db = this.client.db(this.dbName);
		
		this.constructor.collection[collection] = this.db.collection(collection);

		return this.constructor.collection[collection];
	}

	async getLastRecord(collection,sortBy = '_id'){
		
		let sortObj = {};
		sortObj[sortBy] = -1;

		const findLastResult = await this.constructor.collection[collection].find({}).sort(sortObj).limit(1).toArray();

		if(findLastResult.length){
			return findLastResult[0];
		}
		return {error: 'Nu am gasit!'};
	}
}

export default Database;