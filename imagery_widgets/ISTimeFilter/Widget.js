///////////////////////////////////////////////////////////////////////////
// Copyright (c) 2013 Esri. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////
define([
    'dojo/_base/declare',
    'dijit/_WidgetsInTemplateMixin',
    'dojo/text!./Widget.html',
    'jimu/BaseWidget',
    "dijit/registry",
    "dojo/_base/lang",
    "dojo/html",
    "dojo/dom",
    "esri/layers/MosaicRule",
    "esri/tasks/query",
    "esri/tasks/QueryTask",
    "esri/geometry/Extent",
    "dojo/date/locale",
    "dojo/html",
    "dojo/dom-construct",
    "dijit/form/HorizontalSlider",
    "dijit/form/HorizontalRule",
    "dijit/form/HorizontalRuleLabels",
    "esri/graphic",
    "esri/symbols/SimpleLineSymbol",
    "esri/symbols/SimpleFillSymbol",
    "esri/Color",
    "esri/InfoTemplate",
    "dojo/dom-style",
    "esri/layers/ArcGISImageServiceLayer",
    "esri/layers/ImageServiceParameters",
    "esri/tasks/ImageServiceIdentifyTask",
    "esri/tasks/ImageServiceIdentifyParameters",
    "esri/geometry/Polygon",
    "esri/geometry/Point",
    "esri/request",
    "dijit/form/Select",
    "dijit/form/Button",
    "dijit/form/NumberSpinner",
    "dijit/form/CheckBox",
    "dijit/form/TextBox",
    "dijit/form/DropDownButton",
    "dijit/TooltipDialog",
    "dijit/Tooltip"
],
        function(
                declare,
                _WidgetsInTemplateMixin,
                template,
                BaseWidget,
                registry,
                lang,
                html,
                dom,
                MosaicRule,
                Query, QueryTask, Extent, locale, html, domConstruct, HorizontalSlider, HorizontalRule, HorizontalRuleLabels, Graphic, SimpleLineSymbol, SimpleFillSymbol, Color, InfoTemplate, domStyle,ArcGISImageServiceLayer, ImageServiceParameters, ImageServiceIdentifyTask, ImageServiceIdentifyParameters, Polygon, Point, esriRequest) {
            var clazz = declare([BaseWidget, _WidgetsInTemplateMixin], {
                templateString: template,
                name: 'ISTimeFilter',
                baseClass: 'jimu-widget-ISTimeFilter',
                primaryLayer: null,
                secondaryLayer: null,
                orderedDates: null,
                sliderRules: null,
                sliderLabels: null,
                slider: null,
                features: null,
                sliderValue: null,
                featureIds: [],
                responseAlert: true,
                defaultMosaicRule : null,
                startup: function() {
                    this.inherited(arguments);
                    domConstruct.place('<img id="loadingTimeFilter" style="position: absolute;top:0;bottom: 0;left: 0;right: 0;margin:auto;z-index:100;" src="' + require.toUrl('jimu') + '/images/loading.gif">', this.domNode);
                    this.hideLoading();
                },
                postCreate: function() {
                    this.layerInfos = this.config;
                    registry.byId("subtractValue").on("change", lang.hitch(this, this.sliderChange));
                    registry.byId("subtractDateString").on("change", lang.hitch(this, this.sliderChange));
                    registry.byId("refreshTimesliderBtn").on("click", lang.hitch(this, this.timeSliderRefresh));
                    registry.byId("show").on("change", lang.hitch(this, this.sliderChange));
                    registry.byId("timeFilter").on("change", lang.hitch(this, this.setFilterDiv));
                    if (this.map) {
                        this.map.on("update-end", lang.hitch(this, this.refreshData));
                        this.map.on("update-start", lang.hitch(this, this.showLoading));
                        this.map.on("update-end", lang.hitch(this, this.hideLoading));
                    }
                },
                onOpen: function() {
                    this.refreshData();
                },
                checktime : function(currentVersion)
                {
                    if (currentVersion >= 10.21) {
                        if(this.layerInfos[this.label]){
                            if (this.layerInfos[this.label].dateField&&this.layerInfos[this.label].objectID&&this.layerInfos[this.label].category) {
                                this.dateField = this.layerInfos[this.label].dateField;
                                this.objectID = this.layerInfos[this.label].objectID;
                                this.categoryField = this.layerInfos[this.label].category;
                                registry.byId("timeFilter").set("disabled", false);
                                html.set(this.errorDiv, "");
                            } else {
                                registry.byId("timeFilter").set("checked", false);
                                registry.byId("timeFilter").set("disabled", true);
                                if(!this.layerInfos[this.label].dateField){
                                    html.set(this.errorDiv, "Date field is not specified.");
                                }
                                else if(!this.layerInfos[this.label].objectID){
                                    html.set(this.errorDiv, "No ObjectID field.");
                                }
                                else {
                                    html.set(this.errorDiv, "No Category field.");
                                }
                            }
                        }
                        else{
                            registry.byId("timeFilter").set("checked", false);
                            registry.byId("timeFilter").set("disabled", true);
                            html.set(this.errorDiv, "Cannot perform action for primary layer.");
                        }
                    } else {
                        registry.byId("timeFilter").set("checked", false);
                        registry.byId("timeFilter").set("disabled", true);
                        html.set(this.errorDiv, "Services pre 10.2.1 not supported.");
                    }
                },
                refreshData: function() {
                    if (this.map.layerIds) {
                        this.prevPrimary = this.primaryLayer;
                        if (this.map.getLayer("resultLayer")) {
                            if (this.primaryLayer !== this.map.getLayer(this.map.layerIds[this.map.layerIds.length - 2]) && this.primaryLayer) {
                                registry.byId("timeFilter").set("checked", false);
//                                this.timeSliderRefresh();
                            }
                            this.primaryLayer = this.map.getLayer(this.map.layerIds[this.map.layerIds.length - 2]);
                            //this.secondaryLayer = this.map.getLayer(this.map.layerIds[this.map.layerIds.length - 3]);
                            //this.positionOfPrimaryLayer = this.map.layerIds.length - 2;
                        } else {
                            if (this.primaryLayer !== this.map.getLayer(this.map.layerIds[this.map.layerIds.length - 1]) && this.primaryLayer) {
                                registry.byId("timeFilter").set("checked", false);
//                                this.timeSliderRefresh();
                            }
                            this.primaryLayer = this.map.getLayer(this.map.layerIds[this.map.layerIds.length - 1]);
                            //this.secondaryLayer = this.map.getLayer(this.map.layerIds[this.map.layerIds.length - 2]);
                            //this.positionOfPrimaryLayer = this.map.layerIds.length - 1;
                        }
                        
                        this.label = this.primaryLayer.url.split('//')[1];
                        this.defaultMosaicRule = this.primaryLayer.defaultMosaicRule;
                        if (!this.prevPrimary || this.prevPrimary.url !== this.primaryLayer.url) {
                            this.mosaicBackup = this.primaryLayer.mosaicRule;
                            this.primaryLayer.on("visibility-change", lang.hitch(this, this.sliderChange));
                        } else if (this.prevPrimary.url === this.primaryLayer.url && this.primaryLayer.mosaicRule) {
                            if (this.primaryLayer.mosaicRule.method !== "esriMosaicLockRaster") {
                                this.mosaicBackup = this.primaryLayer.mosaicRule;
                            }
                        }
                        
                    
                        var currentVersion = this.primaryLayer.currentVersion;
                            
                        if(this.layerInfos[this.label] && this.primaryLayer.currentVersion)
                        {
                            var currentVersion = this.primaryLayer.currentVersion;
                            this.checktime(currentVersion);
                            dom.byId("layerTitle").innerHTML = this.layerInfos[this.label].title;
                        }
                        else if(this.layerInfos[this.label] && !this.primaryLayer.currentVersion){
                            dom.byId("layerTitle").innerHTML = this.layerInfos[this.label].title;
                            var layersRequest = esriRequest({
                                url: this.primaryLayer.url,
                                content: {f: "json"},
                                handleAs: "json",
                                callbackParamName: "callback"
                            });
                            layersRequest.then(lang.hitch(this, function(data) {
                                var currentVersion = data.currentVersion;
                                this.checktime(currentVersion);
                            }));
                        }
                        else if(!this.layerInfos[this.label]){
                            dom.byId("layerTitle").innerHTML = this.primaryLayer.name||this.primaryLayer.id;
                            var layersRequest = esriRequest({
                                url: this.primaryLayer.url,
                                content: {f: "json"},
                                handleAs: "json",
                                callbackParamName: "callback"
                            });
                            layersRequest.then(lang.hitch(this, function(data) {
                                var currentVersion = data.currentVersion;
                                var obj={title:this.primaryLayer.name||this.primaryLayer.id};
                                var regExp = new RegExp(/acq[a-z]*[_]?Date/i);
                                for (var a in data.fields){
                                    if(data.fields[a].type==="esriFieldTypeOID"){
                                        obj.objectID = data.fields[a].name;
                                    }
                                    if(data.fields[a].name==="Category"){
                                        obj.category = data.fields[a].name;
                                    }
                                    if(regExp.test(data.fields[a].name)){
                                        obj.dateField = data.fields[a].name;
                                    }
                                    else if(!obj.dateField&&data.fields[a].type==="esriFieldTypeDate"){
                                        obj.dateField = data.fields[a].name;
                                    }
                                }
                                this.layerInfos[this.label] = obj;
                                this.checktime(currentVersion);
                            }));
                        }

                        if (!this.slider) {
                            this.timeSliderShow();
                        }
                    }
                },
                setFilterDiv: function() {
                    if (registry.byId("timeFilter").get("checked")) {
                        if (!this.slider) {
                            this.timeSliderShow();
                        } else {
                            this.timeSliderRefresh();
                        }
                        domStyle.set(this.filterDiv, "display", "block");

                    } else {
                        domStyle.set(this.filterDiv, "display", "none");
                        this.map.graphics.clear();
                        var mr = new MosaicRule(this.defaultMosaicRule);
                        this.primaryLayer.setMosaicRule(mr);
                    }
                },
                timeSliderShow: function() {
                    if (this.primaryLayer && registry.byId("timeFilter").get("checked")) {
                        
                        var extent = new Extent(this.map.extent);
                        var xlength = (extent.xmax - extent.xmin) / 4;
                        var ylength = (extent.ymax - extent.ymin) / 4;
                        var xminnew = extent.xmin + xlength;
                        var xmaxnew = extent.xmax - xlength;
                        var yminnew = extent.ymin + ylength;
                        var ymaxnew = extent.ymax - ylength;
                        var extentnew = new Extent(xminnew, yminnew, xmaxnew, ymaxnew, extent.spatialReference);
                        var query = new Query();
                        query.geometry = extentnew;
                        query.outFields = [this.dateField];
                        query.where = this.categoryField+" = 1";
                        query.orderByFields = [this.dateField];
                        query.returnGeometry = true;
                        this.showLoading();
                        var queryTask = new QueryTask(this.primaryLayer.url);
                        queryTask.execute(query, lang.hitch(this, function(result) {
                            this.orderedFeatures = result.features;
                            
                            if(this.orderedFeatures.length){
                                this.orderedDates = [];
                                for (var a in this.orderedFeatures) {
                                    this.orderedDates.push(this.orderedFeatures[a].attributes[this.dateField]);
                                }

                                this.featureLength = this.orderedFeatures.length;

                                var sliderNode = domConstruct.create("div", {}, this.timeSliderDiv, "first");

                                var rulesNode = domConstruct.create("div", {}, sliderNode, "first");
                                this.sliderRules = new HorizontalRule({
                                    container: "bottomDecoration",
                                    count: this.featureLength,
                                    style: "height:5px;"
                                }, rulesNode);

                                var labels = [];
                                for (var i = 0; i < this.orderedDates.length; i++) {
                                    labels[i] = locale.format(new Date(this.orderedDates[i]), {selector: "date", formatLength: "short"});
                                }

                                var labelsNode = domConstruct.create("div", {}, sliderNode, "second");
                                this.sliderLabels = new HorizontalRuleLabels({
                                    container: "bottomDecoration",
                                    labelStyle: "height:1em;font-size:75%;color:gray;",
                                    labels: [labels[0], labels[this.orderedDates.length - 1]]
                                }, labelsNode);

                                this.slider = new HorizontalSlider({
                                    name: "slider",
                                    value: 0,
                                    minimum: 0,
                                    maximum: this.featureLength - 1,
                                    discreteValues: this.featureLength,
                                    onChange: lang.hitch(this, this.sliderChange)
                                }, sliderNode);

                                this.slider.startup();
                                this.sliderRules.startup();
                                this.sliderLabels.startup();
                                var polygonJson = {"rings": [[[extent.xmin, extent.ymin], [extent.xmin, extent.ymax], [extent.xmax, extent.ymax], [extent.xmax, extent.ymin],
                                            [extent.xmin, extent.ymin]]], "spatialReference": {"wkid": 102100}};
                                var polygon = new Polygon(polygonJson);
                                var request = new esriRequest({
                                  url: this.primaryLayer.url + "/getSamples",
                            content: {
                                geometry: JSON.stringify(this.map.extent.getCenter()),
                                geometryType: "esriGeometryPoint",
                                returnGeometry: false,
                                sampleCount: 1,
                                outFields: this.objectID,
                                f: "json"
                            },
                            handleAs: "json",
                            callbackParamName: "callback"
                        });
                                request.then(lang.hitch(this, function(bestScene){
                                     var maxVisible = bestScene.samples[0].attributes[this.objectID];
                                        for (var z in this.orderedFeatures) {
                                            if (this.orderedFeatures[z].attributes[this.objectID] === maxVisible) {
                                                var index = z;
                                            }
                                        }
                                        this.slider.set("value", index);
                                        this.sliderChange();
                                    
                                   html.set(this.dateRange, locale.format(new Date(this.orderedDates[this.featureLength - 1]), {selector: "date", formatLength: "long"}));
                                    html.set(this.imageCount, "1");
                                    this.hideLoading();
                                }), lang.hitch(this, function(){
                                    

                                var imageTask = new ImageServiceIdentifyTask(this.primaryLayer.url);
                                var imageParams = new ImageServiceIdentifyParameters();
                                imageParams.geometry = new Point(polygon.getCentroid());
                                imageParams.returnGeometry = false;
                                imageTask.execute(imageParams, lang.hitch(this, function(data) {
                                    if (data.catalogItems.features[0]) {
                                        var maxVisible = data.catalogItems.features[0].attributes[this.objectID];
                                        for (var z in this.orderedFeatures) {
                                            if (this.orderedFeatures[z].attributes[this.objectID] === maxVisible) {
                                                var index = z;
                                            }
                                        }
                                        this.slider.set("value", index);
                                        this.sliderChange();
                                    }
                                    html.set(this.dateRange, locale.format(new Date(this.orderedDates[this.featureLength - 1]), {selector: "date", formatLength: "long"}));
                                    html.set(this.imageCount, "1");
                                    this.hideLoading();
                                }), lang.hitch(this, function(error) {
                                    this.hideLoading();
                                    this.slider.set("value", 0);
                                    this.sliderChange();
                                }));
                            }));
                            }
                            else {
                                html.set(this.errorDiv, "No primary layer scenes in current extent.");
                                html.set(this.dateRange, "");
                                html.set(this.imageCount, "");
                                this.hideLoading();
                            }
                        }));

                    }
                },
                timeSliderHide: function() {
                    this.sliderRules.destroy();
                    this.sliderLabels.destroy();
                    this.slider.destroy();
                },
                sliderChange: function() {
                    if (registry.byId("timeFilter").get("checked")) {
                        this.sliderValue = this.slider.get("value");
                        var aqDate = this.orderedFeatures[this.slider.get("value")].attributes[this.dateField];
                        var featureSelect = [];
                        this.featureIds = [];
                        var compareDate = new Date(aqDate);
                        var compareValue = registry.byId("subtractValue").get("value");
                        if (compareValue !== 0) {
                            switch (registry.byId("subtractDateString").get("value")) {
                                case "days" :
                                    {
                                        compareDate.setDate(compareDate.getDate() - compareValue);
                                        break;
                                    }
                                case "weeks" :
                                    {
                                        compareDate.setDate(compareDate.getDate() - (compareValue * 7));
                                        break;
                                    }
                                case "months" :
                                    {
                                        compareDate.setMonth(compareDate.getMonth() - compareValue);
                                        break;
                                    }
                                case  "years" :
                                    {
                                        compareDate.setFullYear(compareDate.getFullYear() - compareValue);
                                        break;
                                    }
                            }
                            for (var i = this.orderedFeatures.length - 1; i >= 0; i--) {
                                if (new Date(this.orderedFeatures[i].attributes[this.dateField]) <= new Date(aqDate) && new Date(this.orderedFeatures[i].attributes[this.dateField]) >= compareDate) {
                                    featureSelect.push(this.orderedFeatures[i]);
                                    this.featureIds.push(this.orderedFeatures[i].attributes[this.objectID]);
                                }
                            }
                            html.set(this.dateRange, locale.format(compareDate, {selector: "date", formatLength: "long"}) + " - " + locale.format(new Date(aqDate), {selector: "date", formatLength: "long"}));
                        } else {
                            featureSelect.push(this.orderedFeatures[this.slider.get("value")]);
                            this.featureIds.push(this.orderedFeatures[this.slider.get("value")].attributes[this.objectID]);
                            html.set(this.dateRange, locale.format(new Date(aqDate), {selector: "date", formatLength: "long"}));
                        }

                        this.map.graphics.clear();
                        var count = 0;

                        if (this.primaryLayer.visible) {
                            for (var i = 0; i < featureSelect.length; i++) {
                                if (registry.byId("show").get("value") === "footprint") {
                                    var geometry = featureSelect[i].geometry;
                                    var sms = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([0, 255, 255]), 2), new Color([0, 255, 255, 0.15]));
                                    var attr = featureSelect[i].attributes;
                                    attr[this.dateField] = locale.format(new Date(attr[this.dateField]), {selector: "date", formatLength: "long"});
                                    var infoTemplate = new InfoTemplate("Attributes", "${*}");
                                    var graphic = new Graphic(geometry, sms, attr, infoTemplate);
                                    this.map.graphics.add(graphic);
                                    if (count === 19) {
                                        if (this.responseAlert) {
                                            this.responseAlert = confirm("Number of footprints selected exceed 20. Only first 20 will be displayed. Press OK to warn again.");
                                        }
                                        count++;
                                        break;
                                    }
                                }
                                count++;
                            }
                        }

                        html.set(this.imageCount, "" + count + "");

                        if (registry.byId("show").get("value") === "image") {
                            var mr = new MosaicRule();
                            mr.method = MosaicRule.METHOD_LOCKRASTER;
                            mr.ascending = true;
                            mr.operation = "MT_FIRST";
                            mr.lockRasterIds = this.featureIds;
                            this.primaryLayer.setMosaicRule(mr);
                        } else {
                            if (this.mosaicBackup) {
                                var mr = new MosaicRule(this.mosaicBackup);
                            } else {
                                var mr = new MosaicRule(this.defaultMosaicRule);
                                //var mr = new MosaicRule({"mosaicMethod": "esriMosaicNone", "ascending": true, "mosaicOperation": "MT_FIRST"});
                            }
                            this.primaryLayer.setMosaicRule(mr);
                        }
                    }
                },
              
                timeSliderRefresh: function() {
                    if (this.slider) {
                        this.timeSliderHide();
                        this.timeSliderShow();
                    }
                },
                showLoading: function() {
                   domStyle.set("loadingTimeFilter","display","block");
                },
                hideLoading: function() {
                   domStyle.set("loadingTimeFilter","display","none");
                }
            });

            clazz.hasLocale = false;
            return clazz;
        });