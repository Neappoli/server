# This script creates a file titled 'ottOnlySRs.csv' that contains a list of 
# SRs that require the client's address ID

import requests
import csv
from tqdm import tqdm
import pdb

res = []

r = requests.get('https://city-of-ottawa-prod.apigee.net/open311/v2/services.json').json()

for sr in tqdm(r):
	srCode = sr['service_code']
	srDef = requests.get(f'https://city-of-ottawa-prod.apigee.net/open311/v2/services/{srCode}.json').json()

	for attr in srDef['attributes']:
		if attr['code'] == 'client_address_id_req':
			print(sr['service_name'])
			res.append(srCode)
			break

writer = csv.writer(open('ottOnlySRs.csv', 'w'), delimiter=',', lineterminator='\n')
for srId in res : writer.writerow([srId])

print('Results outputted at ottOnlySRs.csv')