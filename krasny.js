var krasny = function(underscore, jquery){
  var self = this;
  self.VERSION = '1.0.6';
  var HTTP = {get: 'GET', post: 'POST', put: 'PUT', delete: 'DELETE'};
  var models = {};
  var views = {};
  var config = {};
  var modelData = [];
  var viewTemplates = [];
  var getResource = function(uid, resource, callback){
    restAdapter(uid, resource, undefined, callback);
  }
  var restAdapter = function(uid, uri, body, call, args, recursiveFn, callback){
    var req = uri.split(':');
    var httpverb;
    if(req[0] === HTTP.delete || req[0] === HTTP.put || req[0] === HTTP.post) httpverb = req[0];
    req = req.pop();
    jquery.ajax({
      url: req,
      method: httpverb || HTTP.get,
      data: body || {},
      success: function(data){
        call(uid, data);
        if(typeof recursiveFn !== 'undefined') recursiveFn(args, call, callback);
      }
    });
  }
  var retrieveSync = function(resourceArray, call, callback){
    if(resourceArray.length){
      var resource = resourceArray.shift();
      restAdapter(resource.uid, resource.uri, undefined, call, resourceArray, retrieveSync, callback);
    } else callback();
  }
  var View = function(prop){
    var selfView = this;
    selfView.cfg = prop;
    selfView.uid = selfView.cfg.uid;
    if(typeof selfView.uid === 'undefined') throw new Error('View must have `uid` property');
    underscore.each(selfView.cfg, function(v, k){ selfView[k] = v });
    selfView.init = function(html){
      selfView.invalidate(html);
      selfView.html = html;
    }
    selfView.listen = function(){
      underscore.each(selfView.events || {}, function(handler, ev){
        ev = ev.split(" ");
        handler = handler.split(" ");
        var context = selfView.el.find(handler[1]);
        selfView.el.find(ev[1]).on(ev[0], function(e){
          if(handler[1] === 'target') context = e.target;
          selfView[handler[0]](e, jquery(context), selfView.el);
        });
      });
    }
    selfView.invalidate = function(html){
      selfView.el = jquery(selfView.root);
      var compiledHtml = underscore.template(html || selfView.html);
      if(selfView.scope) compiledHtml = compiledHtml({scope: models[selfView.scope].scope});
      jquery(selfView.root).html(compiledHtml);
      if(!html) selfView.listen();
    }
    selfView.render = function(){
      render(selfView);
    }
  }
  var Model = function(prop){
    var selfModel = this;
    selfModel.cfg = prop;
    if(typeof selfModel.cfg.uid === 'undefined') throw new Error('Model must have `uid` property');
    selfModel.uid = selfModel.cfg.uid;
    selfModel.construct = function(fresh){
      var instance = function(){
        var inst = this;
        inst.uid = self.uid;
        inst.attr = {};
        inst.get = function(k){
          return inst.attr[k];
        }
        inst.set = function(k, v){
          inst.attr[k] = v;
        }
        underscore.each(selfModel.cfg.defaults, function(v, k){
          inst.attr[k] = fresh[k] || null;
        });
        underscore.each(selfModel.cfg.methods, function(v, k){
          inst[k] = v;
        });
      };
      return new instance();
    }
    selfModel.search = function(k, v){
      selfModel.scope = underscore.filter(models[prop.uid].collection, function(m){ return m.get(k).indexOf(v) > -1 });
    }
    selfModel.filter = function(k, v){
      selfModel.scope = underscore.filter(models[prop.uid].collection, function(m){ return m.get(k) === v });
    }
    selfModel.all = function(){
      selfModel.scope = models[prop.uid].collection;
      var scopedView = underscore.find(views, underscore.matcher({scope: selfModel.uid}));
      if(scopedView){ scopedView.invalidate() }
    }
    selfModel.fetch = function(){
      fetch(selfModel);
    }
    selfModel.create = function(values, callback){
      var uri = HTTP.post + ':' + config.api + selfModel.uid;
      restAdapter(selfModel.uid, uri, values, callback);
    }
    selfModel.update = function(i, values, callback){
      var uri = HTTP.put + ':' + config.api + selfModel.uid + '/' + models[prop.uid].collection[i].get('id');
      restAdapter(selfModel.uid, uri, values, callback);
    }
    selfModel.delete = function(i, callback){
      var uri = HTTP.delete + ':' + config.api + selfModel.uid + '/' + models[prop.uid].collection[i].get('id');
      restAdapter(selfModel.uid, uri, undefined, callback);
    }
  }
  var createModel = function(prop){
    var tmpmodel = new Model(prop);
    models[tmpmodel.uid] = tmpmodel;
    models[tmpmodel.uid].collection = [];
    modelData.push({uid: tmpmodel.uid, uri: config.api + tmpmodel.uid});
  }
  var createView = function(prop){
    var tmpview = new View(prop);
    views[tmpview.uid] = tmpview;
    viewTemplates.push({uid: tmpview.uid, uri: tmpview.path });
  }
  var fetchModel = function(uid, resp){
    models[uid].collection = [];
    underscore.each(resp, function(f){
      models[uid].collection.push(models[uid].construct(f));
    });
    models[uid].all();
  }
  var renderView = function(uid, html){
    views[uid].init(html);
  }
  var fetch = function(m){
    getResource(m.uid, config.api + m.uid, fetchModel);
  }
  var render = function(v){
    getResource(v.iud, v.path, renderView);
  }
  var listen = function(v){
    v.listen();
  }
  self.app = function(configuration){
    config.api = configuration.apihost || '/';
    underscore.each(configuration.models, createModel);
    retrieveSync(modelData, fetchModel, function(){
      underscore.each(configuration.views, createView);
      retrieveSync(viewTemplates, renderView, function(){
        configuration.controller(models, views, jquery, underscore);
        underscore.each(views, listen);
      });
    });
  }
}
if(typeof module !== 'undefined') module.exports = new krasny(require('underscore'), require('jquery')); else window.K = new krasny(_, $);
