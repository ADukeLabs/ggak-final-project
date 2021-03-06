var global = this;
var draggablePoint;
var temporaryMarker;
var allMarkers = [];

function Controller() {
    this.view = new View();
    this.getType();
    this.getUserLocation();
    this.positionRefresh();
    this.addListeners();
    this.lastWindow;
    this.search();
  }

  Controller.prototype = {
    addListeners: function () {
        var self = this;
        $("#submit-point").on('click', function () {
            self.newPoint();
            $(this).slideToggle();
            $("#content-link").slideToggle();
        });
        $("#save").on('click', function () {
            $("#content-link").slideToggle();
            self.savePoint(draggablePoint);
        });
        $("#close").on('click', function () {
            $("#success-navigation").slideToggle();
            $("#submit-point").slideToggle();
        });
    },
    getType: function () {
        var self = this;
        var queryString = window.location.search.substring(1);
        if (queryString) {
            var pair = queryString.split("=");
            self.pointRefresh(function() { self.getSingleMarker(pair[1]); });
        } else {
            self.pointRefresh(self.getMarkers);
        }
    },
    positionRefresh: function() {
      setInterval(function() {
          this.getUserLocation();
      }.bind(this), 5000);
    },
    pointRefresh: function (getType) {
        var type = getType.bind(this);
        type();
        setInterval(function () {
            for (var i = 0; i < global.allMarkers.length; i++) {
                global.allMarkers[i].setMap(null);
            }
            type();
        }.bind(this), 10000);
    },
    getUserLocation: function () {

      if(navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(this.positionReponse.bind(this), this.positionError.bind(this));
      }
      else {
        handleNoGeolocation(false);
      }
    },
    positionReponse: function (position) {
        var pos = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
        console.log(pos);
      this.checkLocation(pos);
      this.moveUserMarker(pos);
    },
    moveUserMarker: function(pos) {
      if(this.view.userMarker) {
          this.view.userMarker.setPosition(pos);
      }
      else {
          this.view.initializeUserMarker(pos);
          if (window.location.search.substring(1) == null) {
              this.view.map.panTo(pos);
          }
      }
    },
    positionError: function() {
      handleNoGeolocation(true);
    },
    // THis is what I need to fix in order to make it pop up with the marker that corresponds to the ajax response
    checkLocation: function(pos) {
        var self = this;
        var userLat = pos.lat();
        var userLng = pos.lng();
        $.ajax({
            type: "GET",
            url: "api/WayPoints?lat="+userLat+"&lng="+userLng
            //url: "api/WayPoints?lat=-41.3038673&lng=174.742126"
    })
        .done(function (response) {
          if (response.Id != 0) {
              self.findEnteredMarker(response.Id);
          };
        })
        .fail(function() {
            alert("Checking database failed");
        });
    },
    findEnteredMarker: function (id) {
        var pointId = id;
        var self = this;
        $.each(global.allMarkers, function (index, marker) {
            if (marker.title == pointId) {
                self.changeEnteredIcon(marker);
                self.openPoint(marker);
            }
        });
    },
    newPoint: function() {
      var self = this;
      temporaryMarker = this.view.addMarker();
      var latitude = temporaryMarker.getPosition().lat();
      var longitude = temporaryMarker.getPosition().lng();
      draggablePoint = {
          Latitude: latitude,
          Longitude: longitude,
          URL: null,
      };
      google.maps.event.addListener(temporaryMarker, 'dragend', function (event) {
          latitude = temporaryMarker.getPosition().lat();
          longitude = temporaryMarker.getPosition().lng();
          draggablePoint = {
              Latitude: latitude,
              Longitude: longitude,
              URL: null,
          };
      });

    },
    savePoint: function (point) {
        var self = this;
        point.URL = $("#enter-url").val();
        $.ajax({
            type: "POST",
            url: "api/WayPoints",
            data: point
        })
        .done(function (response) {
                var savedMarker = new PointMarker(response);
                savedMarker.placeMarker(self.view.map)
                temporaryMarker.setMap(null);
                $("#success-navigation").slideToggle();
                $("#share").on('click', function () {
                    self.view.generateShareLink(savedMarker);
                });
         })
        .fail(function () {
            $("#fail-message").slideToggle();
        });
    },
    changeEnteredIcon: function(enteredMarker) {
        enteredMarker.setIcon("/Content/openmarker.svg");
    },
    openPoint: function (enteredMarker) {
        var self = this;
        enteredMarker.setAnimation(google.maps.Animation.BOUNCE);
        google.maps.event.clearListeners(enteredMarker, 'click');
        google.maps.event.addListener(enteredMarker, 'click', function () {
            if (self.currentWindow != undefined) {
                self.currentWindow.close();
            }
            self.view.addPopup(enteredMarker);
            enteredMarker.setAnimation(null);
        });
    },
    getMarkers: function () {
        console.log("this", this)
        var self = this;
        $.ajax({
            type: "GET",
            url: "api/WayPoints",
        })
        .done(function (response) {
            self.retrieveMarkers(response);   
            }.bind(self))
        .fail(function() {
            alert("Uh oh! Placing markers failed. Please reload the page.");
        });
      //  return JSON array
    },
    getSingleMarker: function (pointId) {
        var self = this;
        $.ajax({
            type: "GET",
            url: "api/WayPoints/?id=" + pointId,
        })
        .done(function (response) {
            var singleMarker = [response];
            self.retrieveMarkers(singleMarker);
            var newCentre = new google.maps.LatLng(response.Latitude, response.Longitude);
            self.view.map.panTo(newCentre);
            })
        .fail(function () {
            alert("Uh oh! We couldn't find that marker. Ple" +
                "ase reload the page.");
        });
        //  return JSON array
    },
    retrieveMarkers: function (markers) {
        var self = this;
        $.each(markers, function (index, item) {
            var marker = new PointMarker(item);
            var googleMarker = marker.placeMarker(self.view.map);
            global.allMarkers.push(googleMarker);
        });
    },
    search: function () {

        var self = this;
        var markers = [];
        var input = (document.getElementById('pac-input'));
        //self.view.map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

        var searchBox = new google.maps.places.SearchBox(input);

        google.maps.event.addListener(searchBox, 'places_changed', function () {
            var places = searchBox.getPlaces();

            if (places.length == 0) {
                return;
            }
            for (var i = 0, marker; marker = markers[i]; i++) {
                marker.setMap(null);
            }

            markers = [];
            var bounds = new google.maps.LatLngBounds();
            for (var i = 0, place; place = places[i]; i++) {
                var image = {
                    url: place.icon,
                    size: new google.maps.Size(71, 71),
                    origin: new google.maps.Point(0, 0),
                    anchor: new google.maps.Point(17, 34),
                    scaledSize: new google.maps.Size(25, 25)
                };

                var marker = new google.maps.Marker({
                    map: self.view.map,
                    icon: image,
                    title: place.name,
                    position: place.geometry.location
                });

                markers.push(marker);

                bounds.extend(place.geometry.location);
            }

            self.view.map.fitBounds(bounds);
        });

        google.maps.event.addListener(self.view.map, 'bounds_changed', function () {
            var bounds = self.view.map.getBounds();
            searchBox.setBounds(bounds);
        });
    }
  }

        // renderMarkers();
        // map.setCenter(pos);

    // Response if there is an error getting the geolocation



    // Browser doesn't support Geolocation


  // // Error flags if there is a problem

  // function handleNoGeolocation(errorFlag) {
  //   if (errorFlag) {
  //     var content = 'Error: The Geolocation service failed.';
  //   } else {
  //     var content = 'Error: Your browser doesn\'t support geolocation.';
  //   }

  //   var options = {
  //     map: map,
  //     position: new google.maps.LatLng(60, 105),
  //     content: content
  //   };

  //   var infowindow = new google.maps.InfoWindow(options);
  //   map.setCenter(options.position);
  // }

  // var checkLocation = function(pos) {

  //   console.log(pos)

  //   // $.ajax({
  //   //   type: "GET",
  //   //   url: "/api/location",
  //   //   data: { LatLng: pos }
  //   // })
  //   // .done(function( msg ) {
  //   //   alert( "Data Saved: " + msg );
  //   // });
  //   // .fail(function() {
  //   //   alert( "ERROR ERROR BUT INSIDE THIS STUPID FUNCTION YAYA" );
  //   // })
  // }



