// ------------------------------------------------------------------------------
// ----- NY SSER Mapper ----------------------------------------------------------
// ------------------------------------------------------------------------------

// copyright:   2017 Martyn Smith - USGS NY WSC

// authors:  Martyn J. Smith - USGS NY WSC

// purpose:  Web Mapping interface for SSER data

// updates:
// 12.02.2016 mjs - Created
// 05.08.2017 mjs - updated for sser

//config variables
var MapX = '-73.15';
var MapY = '40.7';
var MapZoom = 10;
var map;
var masterGeoJSON,curGeoJSONlayer;
var sitesLayer;  //leaflet feature group representing current filtered set of sites
var layer, layerLabels;
var identifiedFeature;
var filterSelections = [];
var queryString = {};
var popupItems = ['Resp_Org','Project_Nm','Site_Name','Station_ID','Site_Type','Samp_Type','Parameter1','Parameter2','Study_Start_Date','Study_End_Date','Date_Category','DataPublic','Data_Link','RelatedPub','Contact','Latitude','Longitude','CoordDatum','Notes','MGMT_Topic','QAQC_Level','HUC12','Name'];

var geoFilterGroupList = [
	{layerName: "Resp_Org", dropDownID: "RespOrg", label: "Responsible Organization"},
	{layerName: "Site_Type", dropDownID: "SiteType", label: "Site Type"},
	{layerName: "Samp_Type", dropDownID: "SampType", label: "Sample Type"},
	{layerName: "Parameter2", dropDownID: "Parameter2", label: "Parameters"},
	{layerName: "Date_Category", dropDownID: "DateCategory", label: "Monitoring Status"},
	{layerName: "DataPublic", dropDownID: "DataPublic", label: "Data Public"},
	{layerName: "Name", dropDownID: "Name", label: "Waterbody"},
];

var mapServerDetails =  {
	"url": "https://www.sciencebase.gov/arcgis/rest/services/Catalog/587fba36e4b085de6c11f3e8/MapServer",
	"layers": [1,11,12,18,19], 
	//"layers": [1], 
	"visible": true, 
	"opacity": 0.8,
};
var mapServerLegend;
var geoFilterFlag;
var parentArray = [];

toastr.options = {
  'positionClass': 'toast-bottom-right',
};

if (process.env.NODE_ENV !== 'production') {
  require('../index.html');
}

//instantiate map
$( document ).ready(function() {
	console.log('Application Information: ' + process.env.NODE_ENV + ' ' + 'version ' + VERSION);
	$('#appVersion').html('Application Information: ' + process.env.NODE_ENV + ' ' + 'version ' + VERSION);

	//create map
	map = L.map('mapDiv',{zoomControl: false});

	L.Icon.Default.imagePath = './images/';

	//add zoom control with your options
	L.control.zoom({position:'topright'}).addTo(map);  
	L.control.scale().addTo(map);

	//change cursor
	$('#mapDiv').css('cursor', 'pointer');

	//basemap
	layer = L.esri.basemapLayer('DarkGray').addTo(map);

	//set initial view
	map.setView([MapY, MapX], MapZoom);
		
	//define layers
	sitesLayer = L.featureGroup().addTo(map);

	//add map layers
	parseBaseLayers();

	//add filters
	populateGeoFilters();
	
	/*  START EVENT HANDLERS */
	$('#mobile-main-menu').click(function() {
		$('body').toggleClass('isOpenMenu');
	});

	$('.basemapBtn').click(function() {
		$('.basemapBtn').removeClass('slick-btn-selection');
		$(this).addClass('slick-btn-selection');
		var baseMap = this.id.replace('btn','');
		setBasemap(baseMap);
	});

	$('#resetView').click(function() {
		resetView();
	});

	$('#resetFilters').click(function() {
		resetFilters();
	});

	$('#aboutButton').click(function() {
		$('#aboutModal').modal('show');
	});	

	$('#exportGeoJSON').click(function() {
		downloadGeoJSON();
	});	

	$('#exportKML').click(function() {
		downloadKML();
	});	

	$('#exportCSV').click(function() {
		downloadCSV();
	});	

	$('#geoFilterSelect').on('changed.bs.select', function (event, clickedIndex, newValue, oldValue) {
		geoFilterSelect(event, clickedIndex, newValue, oldValue);
	});

	map.on('click', function (e) {
		mapClickQuery(e);
	});	

	//click listener for regular button
	$('#baseLayerToggles').on('click', '.layerToggle', function(e) {
		var button  = this;
		toggleBaseLayer(e,button);
	});

	/*  END EVENT HANDLERS */
});

function toggleBaseLayer(e, button) {
	
	var layerID = parseInt($(button).attr('value'));		
	
	//layer toggle
	var visibleLayers = mapServer.getLayers();
	var index = -1;

	//there is something on the map already
	if (visibleLayers) index = visibleLayers.indexOf(layerID);

	//case 1, remove this layer from the map
	if (index > -1) {
		//console.log('map already has this layer: ', layerID);
		visibleLayers.splice(index, 1);

		//if there is nothing in visibleLayers, have to remove the map layer to clear
		if (visibleLayers.length === 0) {
			map.removeLayer(mapServer);
		}

		//otherwise just set to the current list
		else {
			mapServer.setLayers(visibleLayers);
		}
		
		//console.log('current visible layers: ', visibleLayers);	
		$(button).removeClass('slick-btn-selection');
	} 
	
	//case 2, add this layer to existing layers
	else {
		//console.log('map DOES NOT have this layer: ', layerID);
		$(button).addClass('slick-btn-selection');
		visibleLayers.push(layerID);
		mapServer.setLayers(visibleLayers);
		//map.addLayer(mapServer);
		//console.log('current visible layers: ', visibleLayers);
	}
}

function mapClickQuery(e) {
	var visibleLayers = mapServer.getLayers();
	if (visibleLayers.length > 0) {
		mapServer.identify().on(map).at(e.latlng).layers("visible:" + visibleLayers[0]).run(function(error, featureCollection){
			if (featureCollection.features.length > 0) {
			$.each(featureCollection.features, function (index,value) {

				if (map.hasLayer(identifiedFeature)) map.removeLayer(identifiedFeature);
				identifiedFeature = L.geoJson(value).addTo(map);

				$.each(mapServerLegend.layers, function (index, layer) {
					if (layer.layerId === value.layerId) {
						var popupContent = '<h5>' + layer.layerName + '</h5>';
						
						$.each(value.properties, function (key, field) {
							popupContent += '<strong>' + key + ': </strong>' + field + '</br>';
						});
						
						popup = L.popup()
						.setLatLng(e.latlng)
						.setContent(popupContent)
						.openOn(map);
					}
				});
				
			});
			}
			else {
			//pane.innerHTML = 'No features identified.';
			}
		});
	}
}

function geoFilterSelect(event, clickedIndex, newValue, oldValue) {
	var parentSelectID = $(event.target).attr('id');
	var parentSelect = parentSelectID.replace('-select','')
	var selectArray = $(event.target).find('option:selected');
	var singleSelectCount = selectArray.length;
	var currentSelected = $(event.target).find('option')[clickedIndex];
	var	value = $(currentSelected).attr('value');
	var	name = $(currentSelected).text();

	if (singleSelectCount === 0) {
		var index = parentArray.indexOf(parentSelectID);
		if (index > -1) {
			parentArray.splice(index, 1);
		}
	}

	//find how many different selects have options selected
	$.each($('#geoFilterSelect').find('option:selected'), function (index,value) {
		var parent = $(value).parent().attr('id');
		if (parentArray.indexOf(parent) === -1) {
			parentArray.push(parent);
		}
	});

	//console.log('here1',selectArray.length,parentArray.length)

	//if operation is a deselect, get remaining selected options
	if (newValue === false) {
		
		console.log('Removing the filter:',parentSelect,value)
		for (i = 0; i < filterSelections.length; i++) { 
			if (filterSelections[i].selectName == parentSelect && filterSelections[i].optionValue == value) {
				//console.log('found something to remove')
				filterSelections.splice(i, 1);
			}
		}
	}

	//assume new selection
	else {
		var filterSelect = {selectName:parentSelect, optionValue:value};
		filterSelections.push(filterSelect);
	}

	//if all in a single select are unselected, reset filters
	if (singleSelectCount === 0 && parentArray.length === 0) {
		toastr.info('You just unselected all options, resetting filters', 'Info');
		resetView();
		return;
	}

	//otherwise do query
	else {
		toastr.info('Querying sites...', {timeOut: 0, extendedTimeOut: 0});
		//console.log('doing query',filterSelections)

		//if multiple parent dropdowns in use, assume conditional 'AND' (remove sites from subset)
		if (parentArray.length > 1) {
			//loadSites(curGeoJSONlayer.toGeoJSON(),[filterSelect]);
			siteQuery(filterSelections,'AND');
		}

		//otherwise add sites from master, simulating conditional 'OR'
		else {
			//loadSites(masterGeoJSON,filterSelections);
			siteQuery(filterSelections, 'OR');
		}			
	}
}

function siteQuery(selections, method) {
	//console.log('in siteQuqery',selections, method);

	queryString = {};
	var queryList = [];

	$.each(selections, function(index,selection) {		

		//console.log(selections,index,selection);

		//use special 'like' query if parameter2
		if (selection.selectName === 'Parameter2') {
			queryList.push(selections[index].selectName + ' LIKE ' + "'%" + selections[index].optionValue + "%'");
		}
		else {
			queryList.push(selections[index].selectName + '=' + "'" + selections[index].optionValue + "'");
		}
		
	});

	queryString['1'] = queryList.join(' ' + method + ' ');
	console.log('complete queryString:',queryString);
	mapServer.setLayerDefs(queryString);
	toastr.clear();
	toastr.info('Site query completed', {timeOut: 5000});

}

function parseBaseLayers() {

	mapServer = L.esri.dynamicMapLayer(mapServerDetails);
	map.addLayer(mapServer);
	createLegend(mapServer, mapServerDetails);
	
}

function createLegend(mapServer, mapServerDetails) {
	
	$.getJSON(mapServerDetails.url + '/legend?f=json', function (legendResponse) {
		mapServerLegend = legendResponse;
		$.each(mapServerLegend.layers, function (index,legendValue) {

			//console.log('here',index,legendValue, legendValue.layerId)
			var layerLabel = unCamelize(legendValue.layerName);
			
			//if this layer doesn't have multiple symobologies this is easy
			if (legendValue.legend.length === 1) {
				$('#baseLayerToggles').append('<button id="' + camelize(legendValue.layerName) + '" class="btn btn-default slick-btn layerToggle" value="' + legendValue.layerId + '"><img alt="Legend Swatch" src="data:image/png;base64,' + legendValue.legend[0].imageData + '" />' + layerLabel + '</button>');
				
			}

			//otherwise need to loop over all the image swatches and labels
			else {	
				var layerName = camelize(legendValue.layerName.replace(/[{()}]/g, ''));
				$('#baseLayerToggles').append('<div id="' + layerName + '_group"></div>');

				$('#' + layerName + '_group').append('<button id="' + layerName + '" class="btn btn-default slick-btn layerToggle" value="' + legendValue.layerId + '">' + layerLabel + '</button>');

				$.each(legendValue.legend, function (index,legendItem) {
					$('#' + layerName + '_group').append('<div class="subitem" </br><img alt="Legend Swatch" src="data:image/png;base64,' + legendItem.imageData + '" /><span>' + legendItem.label + '</span></div>');
				});
			}

			//select legend items from initial visibility array and auto-select them
			if (mapServerDetails.layers.indexOf(legendValue.layerId) != -1) $('#' + layerName).addClass('slick-btn-selection');
		});
	});
}

function refreshAndSortFilters() {

	//loop over each select dropdown
	$('.selectpicker').each(function() {
		var id = $(this).attr('id');

		var items = $('#' + id + ' option').get();
		items.sort(function(a,b){
			var keyA = $(a).text();
			var keyB = $(b).text();

			if (keyA < keyB) return -1;
			if (keyA > keyB) return 1;
			return 0;
		});
		var select = $('#' + id);
		$.each(items, function(i, option){
			select.append(option);
		});
	});

	//refresh them all
	$('.selectpicker').selectpicker('refresh');
}

function populateGeoFilters() {

	//first add main category dropdowns
	$.each(geoFilterGroupList, function(index,item) {
		$("#geoFilterSelect").append("<select id='" + item.layerName + "' class='selectpicker geoFilterSelect' multiple data-selected-text-format='count' data-header='" + item.label + "'title='" + item.label + "'></select>");
	});

	//populate dropdowns
	mapServer.query().layer('2').where('1=1').ids(function(error, ids){

		var iterations = Math.ceil(ids.length/1000)

		for(var i=0; i<iterations;i++){
			
			var index = i*1000;
			//console.log('iteration',i, index,index+1000,'OBJECTID>= ' + index + ' and OBJECTID< ' + (index+1000));
			mapServer.query().layer('2').where('OBJECTID>= ' + index + ' and OBJECTID< ' + index+1000).run(function(error, featureCollection){

				if (featureCollection && featureCollection.features.length > 0) {

					//console.log('response', featureCollection);
					$.each(featureCollection.features, function(index, feature) {
						//console.log('feature',feature)
						$.each(feature.properties, function(key, value) {

							//loop over filiter list
							$.each(geoFilterGroupList, function(index, filter) {
								if (filter.layerName === key) {

									//special method for parameter2
									if (filter.layerName === 'Parameter2') {
										
										var values = value.split(',');
										$.each(values, function(index, splitVal) {
											//console.log('here2',splitVal);
											var newVal = splitVal.trim();
											addFilterOption(newVal, newVal, '#' + filter.layerName);
										});
									}
									//otherwise parse as normal
									else {
										addFilterOption(value, value, '#' + filter.layerName);
									}
								}
							});
						});
					});
				}
				//need to do refresh for filters to show up
				refreshAndSortFilters();
			});
		}
	});
}

function addFilterOption(code, text, elementName) {
	//console.log('adding filter',code, text, elementName)
	//add it if it doesn't exist
	if (code && code !== 'na' && $(elementName + ' option[value="' + code + '"]').length === 0) {
		//console.log('adding an option for:',elementName,code)
		$(elementName).append($('<option></option>').attr('value',code).text(text));
	}
}

function createGeoFilterGroups(list) {
	$.each(list, function(index, filter) {

		//create dropdown menus
		$("#geoFilterSelect").append("<select id='" + filter.dropDownID + "-select' class='selectpicker geoFilterSelect' multiple data-selected-text-format='count' data-header='" + filter.layerName + "' title='" + filter.layerName + "'></select>");
	});

	loadCSV(CSVurl);
}

function downloadSites(_callback) {

	//check if we have a query if not make sure we query all
	if ($.isEmptyObject(queryString)) {
		queryString = {1:"1=1"}
	}

	$.each(queryString, function (key,value) {
		
		//have to do double loop to get geometries because possibility of >1000 features
		mapServer.query().layer(key).where(value).ids(function(error, ids){
			
			console.log('total sites:',ids.length)
			
			//check if more than 1000 sites
			if (ids.length < 1000) {
				mapServer.query().layer(key).where(value).run(function(error, featureCollection){
					//console.log(featureCollection);
					//return featureCollection;
					_callback(featureCollection);
				});
			}

			else {
				var iterations = Math.ceil(ids.length/1000)
				var features = [];
				for(var i=0; i<iterations;i++){
					
					var index = i*1000;
					//console.log(value + ' and OBJECTID>= ' + index + ' and OBJECTID< ' + (index+1000).toString());
					mapServer.query().layer(key).where(value + ' and OBJECTID>= ' + index + ' and OBJECTID< ' + index+1000).run(function(error, featureCollection){

						//loop over individual features
						featureCollection.features.forEach(function(feature) {
							features.push(feature);
						});

						//each loop check if were done
						if (features.length === ids.length) {
							_callback({type:'FeatureCollection',features:features})
						}

					});

				}
			}
		});
	});
}

function downloadGeoJSON() {

	downloadSites(function(featureCollection) {

		//for some reason the leaflet toGeoJSON wraps the geojson in a second feature collection
		if (featureCollection.features[0]) {
			var GeoJSON = JSON.stringify(featureCollection);
			var filename = 'data.geojson';
			downloadFile(GeoJSON,filename)
		}
		else {
			toastr.error('Error', 'No sites to export', {timeOut: 0})
		}
    });
}

function downloadKML() {
	//https://github.com/mapbox/tokml
	//https://gis.stackexchange.com/questions/159344/export-to-kml-option-using-leaflet

	downloadSites(function(featureCollection) {
		if (featureCollection.features[0]) {
			var GeoJSON = featureCollection.features[0];
			var kml = tokml(GeoJSON);
			var filename = 'data.kml';
			downloadFile(kml,filename);
		}
		else {
			toastr.error('Error', 'No sites to export', {timeOut: 0})
		}
	});

}

function downloadCSV() {

	downloadSites(function(featureCollection) {
		if (featureCollection.features[0]) {
			//get headers
			var attributeNames = Object.keys(featureCollection.features[0].properties);
	
			// write csv file
			var csvData = [];
			csvData.push(attributeNames.join(','));
	
			featureCollection.features.forEach(function(feature) {
				var attributes = [];
				attributeNames.forEach(function(name) {
					var text = '';
					if (feature.properties[name]) text = feature.properties[name].toString();
					console.log('here',name,text)
					attributes.push(text);
				});
				csvData.push(attributes);
			});
	
			csvData = csvData.join('\n');
	
			var filename = 'data.csv';
			downloadFile(csvData,filename);
		}
	
		else {
			toastr.error('Error', 'No sites to export', {timeOut: 0})
		}
	});
}

function downloadFile(data,filename) {
	var blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
	if (navigator.msSaveBlob) { // IE 10+
		navigator.msSaveBlob(blob, filename);
	} else {
		var link = document.createElement('a');
		var url = URL.createObjectURL(blob);
		if (link.download !== undefined) { // feature detection
			// Browsers that support HTML5 download attribute
			link.setAttribute('href', url);
			link.setAttribute('download', filename);
			link.style.visibility = 'hidden';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
		else {
			window.open(url);
		}
	}
}

function setBasemap(basemap) {
	if (layer) {
		map.removeLayer(layer);
	}

	layer = L.esri.basemapLayer(basemap);

	map.addLayer(layer);

	if (layerLabels) {
		map.removeLayer(layerLabels);
	}

	if (basemap === 'ShadedRelief'
		|| basemap === 'Oceans'
		|| basemap === 'Gray'
		|| basemap === 'DarkGray'
		|| basemap === 'Imagery'
		|| basemap === 'Terrain'
	) {
		layerLabels = L.esri.basemapLayer(basemap + 'Labels');
		map.addLayer(layerLabels);
	}
}

function resetFilters() {
	$('.selectpicker').selectpicker('deselectAll');

	parentArray = [];
	filterSelections = [];

	mapServer.setLayerDefs({});
}

function resetView() {

	$('#showConstituentFilterSelect').show();
	$('#geoFilterSelect').show();
	$('#constituentFilterSelect').hide();

	//reset filters
	resetFilters();

	//reset view
	map.setView([MapY, MapX], MapZoom);
}

function camelize(str) {
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, function(letter, index) {
        return index == 0 ? letter.toLowerCase() : letter.toUpperCase();
    })
	//replace squackets
	.replace(/[\[\]']+/g,'')
	.replace(/\s+/g, '');
}

function unCamelize (str){
    return str
        // insert a space between lower & upper
        .replace(/([a-z])([A-Z])/g, '$1 $2')
		//replace underscores with spaces
		.replace(/_/g, " ")
        // space before last upper in a sequence followed by lower
        .replace(/\b([A-Z]+)([A-Z])([a-z])/, '$1 $2$3')
        // uppercase the first character
        .replace(/^./, function(str){ return str.toUpperCase(); })
}