mapboxgl.accessToken = mapToken;

// const getUserLocation = () => {
//    if (navigator.geolocation) {
//       navigator.geolocation.getCurrentPosition((position) => {
//          const { longitude, latitude } = position.coords;
//          map.easeTo({ center: [longitude, latitude] });
//       });
//    } else {
//       console.log('User Location Denied');
//       return;
//    }
// };

/**
 * To center on the US [-103.5917, 40.6699]
 */
const map = new mapboxgl.Map({
   container: 'cluster-map', //html container
   style: 'mapbox://styles/mapbox/light-v10',
   center: mapConfig.centerOn, //center on user entered location
   // center: [-103.5917, 40.6699], //centers on US
   maxBounds: mapConfig.bounds,
   zoom: mapConfig.zoom
});

let currentLayers = [];

map.addControl(new mapboxgl.NavigationControl({ showCompass: false }));

function mapInit(campgroundsData) {
   console.log('campData', campgroundsData);
   // getUserLocation();
   // Add a new source from our GeoJSON data and
   // set the 'cluster' option to true. GL-JS will
   // add the point_count property to your source data.
   map.addSource('campgrounds', {
      type: 'geojson',
      // Point to GeoJSON data. This example visualizes all M1.0+ earthquakes
      // from 12/22/15 to 1/21/16 as logged by USGS' Earthquake hazards program.
      // data: 'https://docs.mapbox.com/mapbox-gl-js/assets/earthquakes.geojson',
      /**
       * data is expected to be in the form { features : ['all my data']}
       * @features is an array 
       */
      data: campgroundsData, // campgrounds variable passed in from ejs
      cluster: true,
      clusterMaxZoom: 14, // Max zoom to cluster points on
      clusterRadius: 50 // Radius of each cluster when clustering points (defaults to 50)
   });

   map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'campgrounds',
      filter: ['has', 'point_count'],
      paint: {
         // Use step expressions (https://docs.mapbox.com/mapbox-gl-js/style-spec/#expressions-step)
         // with three steps to implement three types of circles:
         //   * Blue, 20px circles when point count is less than 100
         //   * Yellow, 30px circles when point count is between 100 and 750
         //   * Pink, 40px circles when point count is greater than or equal to 750
         'circle-color': [
            'step',
            ['get', 'point_count'],
            '#51bbd6',
            10,
            '#f1f075',
            100,
            '#f28cb1'
         ],
         'circle-radius': [
            'step',
            ['get', 'point_count'],
            15,
            100,
            20,
            750,
            25
         ]
      }
   });
   currentLayers.push('clusters');
   /** controls the text inside the circle */
   map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'campgrounds',
      filter: ['has', 'point_count'],
      layout: {
         'text-field': '{point_count_abbreviated}', // can add text to display in circle - 'text {point_count...}'
         'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
         'text-size': 12
      }
   });
   currentLayers.push('cluster-count');
   /** single point on a map */
   map.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'campgrounds',
      filter: ['!', ['has', 'point_count']], // 'not(hasPointCount)' - is this a single point
      paint: {
         'circle-color': '#11b4da',
         'circle-radius': 8,
         'circle-stroke-width': 1,
         'circle-stroke-color': '#fff'
      }
   });
   currentLayers.push('unclustered-point');
   console.log('map init ok');
   console.log('currentLayers', currentLayers);
}

function resetMap(layers) {
   for (let layer of layers) {
      map.removeLayer(layer);
      console.log('layer', layer);
   }
   currentLayers = [];
   map.setMaxBounds(null);
   map.removeSource('campgrounds');
   console.log('reset map complete');
}

map.on('load', () => {

   mapInit(campgrounds);

   // inspect a cluster on click
   map.on('click', 'clusters', (e) => {
      const features = map.queryRenderedFeatures(e.point, {
         layers: ['clusters']
      });
      const clusterId = features[0].properties.cluster_id;
      map.getSource('campgrounds').getClusterExpansionZoom(
         clusterId,
         (err, zoom) => {
            if (err) return;

            map.easeTo({
               center: features[0].geometry.coordinates,
               zoom: zoom
            });
         }
      );
   });

   // When a click event occurs on a feature in
   // the unclustered-point layer, open a popup at
   // the location of the feature, with
   // description HTML from its properties.
   map.on('click', 'unclustered-point', (e) => {
      //slice() returns a new array, otherwise the memory address is returned to the original array - both should work fine
      const coordinates = e.features[0].geometry.coordinates.slice();
      const { popUpMarkup } = e.features[0].properties;

      // Ensure that if the map is zoomed out such that
      // multiple copies of the feature are visible, the
      // popup appears over the copy being pointed to.
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
         coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      new mapboxgl.Popup()
         .setLngLat(coordinates)
         .setHTML(popUpMarkup)
         .addTo(map);
   });

   map.on('mouseenter', 'clusters', () => {
      map.getCanvas().style.cursor = 'pointer';
   });
   map.on('mouseleave', 'clusters', () => {
      map.getCanvas().style.cursor = '';
   });

   const customGeo = document.querySelector('#mapbox-custom-geo');
   customGeo.addEventListener('change', myfetch);
   async function myfetch(evt) {
      const res = await fetch('/campgrounds/geolocate?searchLocation=' + evt.target.value + '&api=true');
      const data = await res.json();
      console.log(data);
      resetMap(currentLayers);
      mapInit({ features: data.campgrounds });
      // map.flyTo({ center: data.mapConfig.centerOn, zoom: data.mapConfig.zoom });
      const test = map.flyTo({
         center: data.mapConfig.centerOn,
         zoom: data.mapConfig.zoom,
         curve: 1,
         speed: 1.2
      });
      //update bounds after map has finished animation
      function moveEnd() {
         console.log('map end');
         map.setMaxBounds(data.mapConfig.bounds);
         // remove listener
         map.off('moveend', moveEnd);
         console.log(map);
      }
      map.on('moveend', moveEnd);
   };
});