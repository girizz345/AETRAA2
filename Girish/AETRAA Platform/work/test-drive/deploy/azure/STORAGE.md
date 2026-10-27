# The file store on Azure (K2)

Until K2, the live server kept every file in PostgreSQL: drawings, photos, templates and attachments. That is 32 GB, shared by every company. A file stored as base64 takes about four thirds of its size. Spec §12 says bulk loading stays off until files are out of the database.

Now files go to **Azure Blob Storage** in UAE North, in the same resource group, when these settings are on the server:

| Setting | Value |
|---|---|
| `AZURE_STORAGE_ACCOUNT` | the storage account name |
| `AZURE_STORAGE_KEY` | an account key (Shared Key, signed by the app) — or `AZURE_STORAGE_SAS`, a SAS token with read, write, delete and create on the container |
| `AZURE_STORAGE_CONTAINER` | `aetraa-files` |
| `AZURE_STORAGE_ENDPOINT` | optional; defaults to `https://<account>.blob.core.windows.net` |
| `AZURE_STORAGE_CONNECTION_STRING` | alternative to the three above (the form the portal and Azurite give) |
| `DATABASE_LIMIT_GB` | the database's size limit, for the storage screen and the 80% alert; `32` |

With none of these set, nothing changes and files stay in the database.

## A new server

`azure-setup.sh` creates the storage account (`aetraafiles<suffix>`, StorageV2, `Standard_LRS`; set `AETRAA_STORAGE_SKU=Standard_ZRS` for zone-redundant), still in UAE North. It also creates:
- a private container
- 14-day soft delete for blobs and for the container
- versioning
- network access from the app server's address only

It writes the settings above into the app's environment.

## A server already running

In Cloud Shell, with the names from `~/aetraa-azure.env`:

```bash
. ~/aetraa-azure.env
ST_NAME=aetraafiles$SUFFIX; ST_CONTAINER=aetraa-files; RG=aetraa-rg; LOC=uaenorth
az provider register --namespace Microsoft.Storage --wait
az storage account create -g $RG -n $ST_NAME -l $LOC --sku Standard_LRS --kind StorageV2 \
  --min-tls-version TLS1_2 --https-only true --allow-blob-public-access false
az storage account blob-service-properties update -g $RG --account-name $ST_NAME \
  --enable-delete-retention true --delete-retention-days 14 \
  --enable-container-delete-retention true --container-delete-retention-days 14 --enable-versioning true
ST_KEY=$(az storage account keys list -g $RG -n $ST_NAME --query '[0].value' -o tsv)
az storage container create --name $ST_CONTAINER --account-name $ST_NAME --account-key $ST_KEY --public-access off
IP=$(az vm show -d -g $RG -n aetraa-app --query publicIps -o tsv)
az storage account network-rule add -g $RG --account-name $ST_NAME --ip-address $IP
az storage account update -g $RG -n $ST_NAME --default-action Deny --bypass AzureServices
echo "AZURE_STORAGE_ACCOUNT=$ST_NAME  AZURE_STORAGE_CONTAINER=$ST_CONTAINER  AZURE_STORAGE_KEY=$ST_KEY"
```

Then, on the server:

```bash
sudo aetraa-config AZURE_STORAGE_ACCOUNT <name>
sudo aetraa-config AZURE_STORAGE_CONTAINER aetraa-files
sudo aetraa-config AZURE_STORAGE_KEY <key>
sudo aetraa-config DATABASE_LIMIT_GB 32
```

## Checking it, and moving the files already in the database

1. **Check it works.** Sign in as the AETRAA Admin, open **Storage** (from the Admin home), and press **Check the file store now**. A test file is stored, read back and removed. If the store refused it, the screen says where it went instead.
2. **Run the dry run.** The Storage screen counts every file still in PostgreSQL, by kind and by project, with sizes:
   - the database store's own files
   - drawings uploaded on the register screen
   - site photos
   - held drawings
   - templates kept inline

   Nothing moves.
3. **Move them.** Press **Move them**. The files go across 100 at a time. Each one is written to Blob, read back and compared (SHA-256), and only then removed from the database. A file that fails stays where it was and is listed. Pressing it again carries on.
4. **Give the space back.** PostgreSQL does not shrink on its own. After a large move, run `VACUUM FULL files; VACUUM FULL drawings; VACUUM FULL photos;` in a quiet hour. Or leave it: the space is reused for new rows.

From then on, every new file goes to Blob. A file that Blob refuses goes to the database rather than being lost. It is counted as **fell back** on the Storage screen, so it is seen and moved across, rather than quietly refilling the database.

## Restore

The database and the files are restored separately:
- **Database:** any moment in the last 7 days (the Flexible Server's point-in-time restore), as before.
- **Files:** a file deleted or overwritten in the last 14 days is brought back from the portal (Storage account → Containers → aetraa-files → Show deleted blobs → Undelete), or as a previous version (Versions → Make current version). A deleted container is also kept for 14 days.

To restore the platform to a moment *T*, restore the database to *T*. Every file a row at *T* names is either still in the container or undeletable for 14 days. Files written after *T* are harmless: nothing points at them.

## What stays in the database

Company and project logos stay in the database. They are small and are read on every workbook and page header.
