var http = require('request');
var util = require('util');

module.exports = function (app, addon) {
  var hipchat = require('../lib/hipchat')(addon);

  // Root route. This route will serve the `addon.json` unless a homepage URL is
  // specified in `addon.json`.
  app.get('/',
    function(req, res) {
      // Use content-type negotiation to choose the best way to respond
      res.format({
        // If the request content-type is text-html, it will decide which to serve up
        'text/html': function () {
          res.redirect(addon.descriptor.links.homepage);
        },
        // This logic is here to make sure that the `addon.json` is always
        // served up when requested by the host
        'application/json': function () {
          res.redirect('/atlassian-connect.json');
        }
      });
    }
  );

  // This is an example route that's used by the default for the configuration page
  app.get('/config',
    // Authenticates the request using the JWT token in the request
    addon.authenticate(),
    function(req, res) {
      // The `addon.authenticate()` middleware populates the following:
      // * req.clientInfo: useful information about the add-on client such as the
      //   clientKey, oauth info, and HipChat account info
      // * req.context: contains the context data accompanying the request like
      //   the roomId
      res.render('config', req.context);
    }
  );

  // This is an example route to handle an incoming webhook
  app.post('/webhook',
    addon.authenticate(),
    function(req, res) {
      var url = extractId(req.context.item.message.message);
      hipchat.sendMessage(req.clientInfo, req.context.item.room.id, url, {options: {color: 'gray'}})
        .then(function(data){
          res.send(200);
        });
    }
  );

  // Notify the room that the add-on was installed
  addon.on('installed', function(clientKey, clientInfo, req){
    hipchat.sendMessage(clientInfo, req.body.roomId, 'The ' + addon.descriptor.name + ' add-on has been installed in this room');
  });

  // Clean up clients when uninstalled
  addon.on('uninstalled', function(id){
    addon.settings.client.keys(id+':*', function(err, rep){
      rep.forEach(function(k){
        addon.logger.info('Removing key:', k);
        addon.settings.client.del(k);
      });
    });
  });

  // functions
  function extractId(msg) {
    if (msg === null) {
      return;
    }
    var idRegex = /(^[a-z]+-[0-9]+)|\s([a-z]+-[0-9]+)/ig,
        ids = [],
        links = [];
    ids = msg.match(idRegex);
    if (ids && ids.length > 0) {
      for (var id in ids) {
        links.push(createUrl(ids[id].replace(/^\s/, '')));
      }
    }
    return links.join(' ');
  }

  function createUrl(id) {
    if (id === null) {
      return;
    }
    var url = 'https://' + addon.descriptor.capabilities.webhook.jiraBase + '.atlassian.net/browse/' + id.toUpperCase();
    return '<a href="' + url + '">' + url + '</a>';
  }

};
