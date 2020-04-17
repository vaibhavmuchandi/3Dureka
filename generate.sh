rm -R crypto-config/*

./bin/cryptogen generate --config=crypto-config.yaml

rm config/*

./bin/configtxgen -profile threedpOrgOrdererGenesis -outputBlock ./config/genesis.block

./bin/configtxgen -profile threedpOrgChannel -outputCreateChannelTx ./config/threedpchannel.tx -channelID threedpchannel
