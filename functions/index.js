/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
import { getFirestore } from "firebase/firestore";

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

import https from 'https';
import { initializeApp } from "firebase/app";
//import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyB9mCnzLxpSSzxKME5RXfkT192p6eJZXF0",
  authDomain: "farcaster-post-permissionless.firebaseapp.com",
  projectId: "farcaster-post-permissionless",
  storageBucket: "farcaster-post-permissionless.appspot.com",
  messagingSenderId: "8658554511",
  appId: "1:8658554511:web:9a2cf74d827a3a38f52afa",
  measurementId: "G-38KRYD1258",
  databaseURL: "https://farcaster-post-permissionless-default-rtdb.europe-west1.firebasedatabase.app"
};
const app = initializeApp(firebaseConfig);
//const analytics = getAnalytics(app);

import { getDatabase, ref, set, child, get, remove} from "firebase/database";
const db = getDatabase();

const dbFirestore = getFirestore(app);

function storeFids(id, timestamp, username, address) {
  set(ref(db, 'graph/' + timestamp), {
    fid: id,
    unixtime: timestamp
  });
}

function updateLatest(id, timestamp, username, address) {
  set(ref(db, 'latest/' + timestamp), {
    fid: id,
    name: username,
    owner: address,
    unixtime: timestamp
  });
}

async function deleteRecord(key) {
  const dbReference = ref(getDatabase(), key); // Create a reference to the data location you want to delete
  await remove(dbReference); // Use the remove() function to delete data at the reference
}

async function deleteTopNRecords(additionsLength) {
  const dbRef = ref(getDatabase());
  const snapshot = await get(dbRef, 'latest/');
  if (snapshot.exists()) {
    const data = snapshot.val();
    const fids = Object.keys(data.latest);
    const fidToDelete = fids.slice(0, additionsLength); // Get top keys up to additionsLength
    for (const key of fidToDelete) {
      await deleteRecord('latest/' + key); // Delete each record
    }
  }
}

function retain10latest () {
  const dbRef = ref(getDatabase());
  const snapshot = get(dbRef, 'latest/');
  if (snapshot.exists()) {
    const data = snapshot.val();
    const fids = Object.keys(data.latest);
    fids.sort((a, b) => b - a);
    const fidToDelete = fids.slice(0, 10); // Get top 10 keys
    for (const key of fidToDelete) {
      deleteRecord('latest/' + key); // Delete each record
    }
  }
}

//from_ts=1697320880 will catch only new IDs
let ts = 1697321442;
async function fetchData() {
  https.get(`https://fnames.farcaster.xyz/transfers?from_ts=${ts}`, async (response) => {
    let data = '';
    //console.log("Fetching 100 ids from ID:", from_id)
    response.on('data', (chunk) => {
      data += chunk;
    });

    response.on('end', async () => {
      let parsedData = JSON.parse(data)
      if (parsedData.transfers.length === 0) {
        console.log("No accounts in this batch.")
        return;
      }
      
      let accountCount = parsedData.transfers.length
      console.log(accountCount, " accounts fetched in this batch.")
      if (accountCount > 10) {
        accountCount = 10
      }
      await deleteTopNRecords(accountCount)   

      let latestObjects = parsedData.transfers.slice(-accountCount);
      for (const object of latestObjects) {
        updateLatest(object.id, object.timestamp, object.username, object.owner);
      }
      
      parsedData.transfers.forEach(item => {
        const { id, timestamp, username, owner } = item;
        storeFids(id, timestamp, username, owner);
      });
      //res.send(data);
      /*
      // Fetch next batch of data
      await fetchData(from_id + 100);*/
    });

  }).on('error', (error) => {
    console.error(error);
  });
  ts += 600; // increase ts by 600 (10 minutes)
}
// Run fetchData every 600 seconds
setInterval(fetchData, 600 * 1000);