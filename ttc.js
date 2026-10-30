const GtfsRealtimeBindings = require("gtfs-realtime-bindings");

async function fetchBusAlerts() {
  try {
    // https://gtfsrt.ttc.ca/alerts/subway?format=text on browser can be used to check if the stuff works 
    const response = await fetch("https://gtfsrt.ttc.ca/alerts/subway?format=binary");

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();

    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );

    // debugging for the console to confirm if the data lines up
    console.log(`=============================================`);
    const timestamp = new Date(feed.header.timestamp.low * 1000);
    console.log(`Retrieved at: ${timestamp}`);

    feed.entity.forEach((entity) => {
      if (entity.alert) {
        const alert = entity.alert;
        const headerText = alert.headerText?.translation?.[0]?.text || 'No header';
        const descriptionText = alert.descriptionText?.translation?.[0]?.text || '';
        const start = new Date(alert.activePeriod?.[0].start * 1000);
        const end = new Date(alert.activePeriod?.[0].end * 1000);
        const issue = alert.effect;
        console.log(`[Alert ID: ${entity.id}]`);
        console.log(`Header: ${headerText} length: ${headerText.length}`);
        console.log(`Time: ${start} to ${end}`);
        console.log(`Issue: ${issue}`);
        console.log(`Informed Entities:`, alert.informedEntity);
        console.log('-----------------------------------------');
      }
    });
    

    return feed;
  } catch (error) {
    console.error("Failed to fetch or decode binary alerts:", error);
  }
}

module.exports = {
    fetchBusAlerts
};
// fetchBusAlertsBinary();