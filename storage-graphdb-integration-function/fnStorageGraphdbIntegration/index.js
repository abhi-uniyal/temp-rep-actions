const { AzureFunction, Context } =require("@azure/functions");
const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');
const { exec } = require('child_process');
const fs = require('fs');
require('dotenv').config();


// Set the Shared access Keys for connecting to Storage
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
const folderPath = process.env.AZURE_STORAGE_FOLDER_PATH;
if (!accountName) throw Error('Azure Storage accountName not found');
if (!accountKey) throw Error('Azure Storage accountKey not found');

const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

const blobServiceClient = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  sharedKeyCredential
);


//Function to download the file from Blob
async function downloadFile(containerName, blobName, fileName, context){
  context.log(`${containerName} containerName::: ${blobName} blobName::: ${fileName} fileName:::`);
  // create container client
  const containerClient = await blobServiceClient.getContainerClient(containerName);

  // create blob client
  const blobClient = await containerClient.getBlockBlobClient(blobName);

  // download file
  await blobClient.downloadToFile(fileName);
  context.log(`${fileName} downloaded`);

}


//Function remove the downloaded file
async function removeFile(filepath, context){
    try {
        fs.unlinkSync(filepath)
        context.log(`${filepath} removed`);
    } catch(err) {
     context.log.error(err)
    }
}
//Function remove the downloaded file
async function executeCurl(curlCommand){
  exec(curlCommand, (error, stdout, stderr) => {
    if (error) {
        context.log.error(`Error: ${error}`);
        return;
    }
    context.log(`stdout: ${stdout}`);
    context.log.error(`stderr: ${stderr}`);
    });
}


module.exports = async function (context, myBlob) {
    context.log("JavaScript blob trigger function processed blob \n Blob:", context.bindingData.blobTrigger, "\n Blob Size:", myBlob.length, "Bytes");

    const triggeredBlobName = context.bindingData.name;
    const extension = context.bindingData.extension;
    const blobName = `${triggeredBlobName}.${extension}`;
    const blobPath = `${folderPath}/${blobName}`;
    const fileName = `/tmp/${blobName}`;
    const GRAPHDB_HOST = process.env.GRAPHDB_HOST_IP;
    const GRAPHDB_PORT = process.env.GRAPHDB_HOST_PORT;
    const GRAPHDB_REPO = process.env.GRAPHDB_REPOSITORY;
    const BASIC_AUTH = process.env.MPH_BASIC_AUTH;

    context.log(`${blobName} `);
    context.log(`blobPath : ${blobPath} `);

    //Downlaod the file from Azure Blob Storage
    await downloadFile(containerName, blobPath, fileName, context);

    let curlCommand = '';

    switch (blobName) {
      case 'enrichment.ttl':
        context.log(`filename ::::${fileName} `);
        context.log(`CURL command called.....`);
        //curlCommand = `curl -X PUT -d @${fileName} -H "Content-Type: application/x-turtle;charset=UTF-8" "http://${GRAPHDB_HOST}:${GRAPHDB_PORT}/repositories/${GRAPHDB_REPO}/rdf-graphs/service?graph=https:%2F%2Fknowledge.ikea.net%2Fproduct-range-data-graph%2Freasoner-enrichment&role=context" -H "Authorization: Basic ${BASIC_AUTH}"`;
        break;

      default:
        break;
    }
    context.log(`${curlCommand} `);

    //Execute the curl to uplaod data to graphDB
    if(curlCommand != ''){
      exec(curlCommand, (error, stdout, stderr) => {
      if (error) {
          context.log.error(`Error: ${error}`);
          return;
      }
      context.log(`stdout: ${stdout}`);
      context.log.error(`stderr: ${stderr}`);

      
      //Remove the downladed file after uplaoding to the GraphDB
      removeFile(fileName,context);
      });
    }

};
