import Fastify from 'fastify'
import FastifyCors from 'fastify-cors';

import fetch from "node-fetch";

import xml2js  from 'xml2js';

import Database from './components/Database.js';

const fastify = Fastify({
  logger: true
})

fastify.register(
	FastifyCors, 
	{ 
		origin: ['http://parley.go.ro:5000','http://localhost:5000','http://116.203.129.108:3000']
		// origin: '*'
	}
)

fastify.get('/', async (req, reply) => {

	return {
		success: 1
	}

});

const DB = new Database('efficiency');
// Declare a route
fastify.get('/user/:secret', async (req, reply) => {

	const dbCollection = await DB.connect('users');

	const findResult = await dbCollection.find({secret: req.params.secret}).toArray();
		
	if(!findResult.length){
		return {error: 1}
	}

	return reply.send(findResult[0]);

});

fastify.post('/save', async (req, reply) => {

	const params = req.body;

	const dbCollection = await DB.connect('users');
	
	const insertResult = await dbCollection.updateOne({secret: params.secret},{$set: params},{upsert: true});

	console.log('Inserted documents =>', insertResult);
	
	return {success: 1}
});

fastify.delete('/delete', async (req, reply) => {

	const params = req.body;

	const dbCollection = await DB.connect('users');

	const deleteResult = await dbCollection.updateOne(
	{
		secret: params.secret
	}, {
		$unset: {
			[`invoices.${params.year}.${params.month}`]:""
		}
	})
	
	console.log('Delete document =>', deleteResult);
	
	return {success: 1}
});

fastify.get('/cursbnr', async (req, reply) => {

	const params = req.query;

	const date = new Date(parseInt(params.y),parseInt(params.m)-1,parseInt(params.d),12)

	// if(Object.entries(params).length && params['y'] != null && params['m'] != null && params['d'] != null){
		
	// 	date.setFullYear(parseInt(params['y']));
	// 	date.setMonth((parseInt(params['m'])+12)%12-1);
	// 	date.setDate(parseInt(params['d']));

	// }

	try {
		
		const dbCollection = await DB.connect('rates');

		const findResult = await dbCollection.find({date: `${date.getFullYear()}-${('0'+(date.getMonth()+1)).slice(-2)}-${('0'+date.getDate()).slice(-2)}`}).toArray();

		if(findResult.length){
			return reply.send(findResult[0]);
		}

		const res = await fetch(
			`https://www.bnr.ro/nbrfxrates10days.xml`,
			{
				method: 'GET'
			}
		);

		const sCursBnr = await res.text();

		const parser = new xml2js.Parser(/* options */);

		const oCursBnr = await parser.parseStringPromise(sCursBnr);

		if(oCursBnr?.DataSet?.Body[0]?.Cube == null || oCursBnr.DataSet.Body[0].Cube[0].Rate == null){

			return reply.send(await DB.getLastRecord('rates','timestamps'));

		}

		let rateDay = [];
		let iterateDate = new Date(date)

		while(!rateDay.length){

			rateDay = oCursBnr.DataSet.Body[0].Cube.filter(days => {
				return days['$']?.date === `${iterateDate.getFullYear()}-${('0'+(iterateDate.getMonth()+1)).slice(-2)}-${('0'+iterateDate.getDate()).slice(-2)}`;
			});
			if(!rateDay.length){
				iterateDate.setDate(iterateDate.getDate()-1);
			}
		}

		if(!rateDay.length){
			return reply.send(await DB.getLastRecord('rates','timestamps'));
		}

		const rate = rateDay[0].Rate.filter(rate => {
			return rate['$'].currency === 'EUR'
		})
		
		const data = {
			date: `${iterateDate.getFullYear()}-${('0'+(iterateDate.getMonth()+1)).slice(-2)}-${('0'+iterateDate.getDate()).slice(-2)}`,
			timestamp: iterateDate.getTime(),
			data: {
				currency: 'EUR',
				value: rate[0]['_']
			}
		}
		
		await dbCollection.updateOne({date: data.date},{$set: data},{upsert: true});
		
		return reply.send(data);

	} catch (error) {

		console.log(error);
		
	}

	return reply.send(await DB.getLastRecord('rates','timestamps'));
});

// Run the server!
fastify.listen(3001, '0.0.0.0', (err, address) => {
  if (err) throw err
  fastify.log.info(`server listening on ${address}`)
})