var newColor = "#f00",
	existingColor = "#1f78b4",
	defaultColor = "#fff";

var width  = 950,
    height = 450;

var projection = d3.geo.kavrayskiy7()
	.scale(125)
	.translate([width / 2, height / 2])
	.precision(.1);

var graticule = d3.geo.graticule();

var path = d3.geo.path()
    .projection(projection);

var svg = d3.select("#map-container").append("svg")
    .attr("width", width)
    .attr("height", height);

var g = svg.append("g");

g.append("rect")
	.attr("width", width)
	.attr("height", height)
	.attr("fill","white")
	.attr("opacity",0)
	.on("mouseover",function(){
		hoverData = null;
		if (probe) probe.style("display","none");
	});

var ocean = g.append("g")
    .attr("id", "ocean");

var map = g.append("g")
    .attr("id", "map");

var records = {};

var probe, hoverData;

var timeScale, sliderScale, slider;

var years = [],
    currentFrame = 0,
    interval,
    frameLength = 800,
    isPlaying = false;

var sliderMargin = 65;

// hover popup
probe = d3.select("#map-container").append("div")
    .attr("id","probe");

d3.select("body")
    .append("div")
    .attr("id","loader")
    .style("top", d3.select("#play").node().offsetTop + "px")
    .style("height", d3.select("#date").node().offsetHeight + d3.select("#map-container").node().offsetHeight + "px")

queue()
    .defer(d3.json, "../../../topology/world-110m.json")
    .defer(d3.tsv,  "../../../topology/world-country-names.tsv")
    .defer(d3.json, "../../../topology/extinct.json")
    .await(blend);

function blend(error, world, names, extinct) {
    if (error) throw error;

    var countries = topojson.feature(world, world.objects.countries).features,
        n = countries.length;

	countries = countries.filter(function(d) {
        return names.some(function(n) {
            if (d.id == n.id) return d.name = n.name;
        });
    }).sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });

    // countries that no longer exist
    var formers = topojson.feature(extinct, extinct.objects.countries).features,
        n = formers.length;

	formers = formers.filter(function(d) {
        return names.some(function(n) {
            if (d.id == n.id) return d.name = n.name;
        });
    }).sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });

	// Soviet Union descendent countries' IDs
	var formerUSSR = d3.set([233, 428, 440, 398, 417, 726, 795, 860, 112, 498, 804, 643, 51, 31, 268]);

	var merged_countries = [{
			"geometry": topojson.merge(world, world.objects.countries.geometries.filter(function(d) { return formerUSSR.has(d.id); })),
			"name": "Soviet Union",
			"type": "Feature",
			"id": 1003
		}, {
			"geometry": topojson.merge(world, world.objects.countries.geometries.filter(function(d) { return d3.set([203, 703]).has(d.id); })),
			"name": "Czechoslovakia",
			"type": "Feature",
			"id": 1004
		}, {
			"geometry": topojson.merge(world, world.objects.countries.geometries.filter(function(d) { return d3.set([408, 410]).has(d.id); })),
			"name": "Korea",
			"type": "Feature",
			"id": 1007
		}, {
			"geometry": topojson.merge(world, world.objects.countries.geometries.filter(function(d) { return d3.set([705, 191, 70, 688, 499, 807, -2]).has(d.id); })),
			"name": "Yugoslavia",
			"type": "Feature",
			"id": 1002
		}, {
			"geometry": topojson.merge(world, world.objects.countries.geometries.filter(function(d) { return d3.set([516, 710]).has(d.id); })),
			"name": "South Africa",
			"type": "Feature",
			"id": "SA_Namibia"
		}, {
			"geometry": topojson.merge(world, world.objects.countries.geometries.filter(function(d) { return d3.set([156, 496]).has(d.id); })),
			"name": "China",
			"type": "Feature",
			"id": "China_Mongolia"
		}, {
			"geometry": topojson.merge(world, world.objects.countries.geometries.filter(function(d) { return d3.set([-3, 706]).has(d.id); })),
			"name": "Somali Republic",
			"type": "Feature",
			"id": "Somali_Republic"
		}];

	// merge the past and present country polygon into one array
	countries = countries.concat(merged_countries, formers);

    initialize(countries);
}

function initialize(countries) {
    d3.select("#loader").remove();

	// ocean & globe border
    ocean.append("path")
       .datum(graticule.outline)
       .attr("class", "ocean")
       .attr("d", path);

    map.selectAll("path")
        .data(countries)
      .enter().append("path")
        .attr("vector-effect","non-scaling-stroke")
        .attr("class","country")
        .attr("fill", defaultColor)
		.attr("stroke", defaultColor)
        .attr("id", function (d) { return "c" + d.id; })
        .attr("d", path);
}

function drawYear(y) {
    map.selectAll(".country")
        .transition()
        .ease("linear")
        .duration(frameLength*.8)
        .attr("fill", function(d) {
            switch (records[y][d.name]) {
                case 1:  d3.select(this).moveToFront(); return newColor; break;
                case 2:  return existingColor; break;
                default: return defaultColor;
            }
        })
        .attr("stroke", function(d) { return ([1,2].indexOf(records[y][d.name]) != -1) ? "#000" : "#555"; })
		.attr("opacity", function(d) { noMore(d, y, d3.select(this)); });

	map.selectAll(".country")
		.on("mouseover", function(d) {
			if (records[y][d.name]) {
				probe.style({
					"display" : "block",
					"top" : (d3.event.pageY - 40) + "px",
					"left" : (d3.event.pageX + 10) + "px"
				})
				.html("<strong>" + d.name + "</strong><br/>");
			}
		})
		.on("mouseout",function(){
			hoverData = null;
			probe.style("display","none");
		});

    d3.select("#date p#year").html(y);
}

function animate() {
  interval = setInterval(function(){
    currentFrame++;

    if (currentFrame == years.length) currentFrame = 0;

    d3.select("#slider-div .d3-slider-handle")
      .style("left", 100*currentFrame/(years.length-1) + "%" );
    slider.value(currentFrame)

    drawYear(years[currentFrame]);

    if (currentFrame == years.length - 1){
      isPlaying = false;
      d3.select("#play").classed("pause",false).attr("title","Play animation");
      clearInterval( interval );
      return;
    }

  }, frameLength);
}

function createSlider() {
  sliderScale = d3.scale.linear().domain([0, years.length-1]);

  var val = slider ? slider.value() : 0;

  slider = d3.slider()
    .scale(sliderScale)
    .on("slide",function(event,value){
		if (isPlaying) clearInterval(interval);
		currentFrame = value;
		drawYear(years[value], d3.event.type != "drag");
    })
    .on("slideend",function(){
        if (isPlaying) animate();
    })
    .on("slidestart",function(){
        d3.select("#slider-div").on("mousemove",null)
    })
    .value(val);

  d3.select("#slider-div").remove();

  d3.select("#slider-container")
    .append("div")
    .attr("id","slider-div")
    .style("width",timeScale.range()[1] + "px")
    .on("mouseout",function(){
        d3.select("#slider-probe").style("display","none");
    })
    .call(slider);

  d3.select("#slider-div a").on("mousemove",function(){
    d3.event.stopPropagation();
  })

  var sliderAxis = d3.svg.axis()
    .scale(timeScale)
    .tickSize(10)
    .tickFormat(d3.format(".0f"))
    .orient("bottom");

  d3.select("#axis").remove();

  d3.select("#slider-container")
    .append("svg")
    .attr("id","axis")
    .attr("width", timeScale.range()[1] + sliderMargin*2)
    .attr("height",25)
    .append("g")
      .attr("transform","translate(" + (sliderMargin+1) + ",0)")
      .call(sliderAxis);

  d3.select("#axis > g g:first-child text").attr("text-anchor","end").style("text-anchor","end");
  d3.select("#axis > g g:last-of-type text").attr("text-anchor","start").style("text-anchor","start");
}

function resize() {
  var w = d3.select("#container").node().offsetWidth,
      h = window.innerHeight - 80;
  var scale = Math.max(1, Math.min(w/width, h/height));
  svg
    .attr("width",width*scale)
    .attr("height",height*scale);
  g.attr("transform","scale(" + scale + "," + scale + ")");

  d3.select("#map-container").style("width", width*scale + "px");

  timeScale.range([0,500 + w-width]);

  createSlider();
}

function noMore(d, y, sel) {
	if (d.name == "Soviet Union") {
    	if (y > 1991) { sel.moveToBack(); return 0; }
    	else { sel.moveToFront(); return 1; }
    }
    if (d.name == "Korea") {
    	if (y > 1944) { sel.moveToBack(); return 0; }
    	else { sel.moveToFront(); return 1; }
    }
    else if (["West Germany", "East Germany"].indexOf(d.name) > -1) {
    	if (y > 1990 || y < 1945) { sel.moveToBack(); return 0; }
    	else { sel.moveToFront(); return 1; }
    }
    else if (d.name == "Yugoslavia") {
    	if (y > 1992) { sel.moveToBack(); return 0; }
    	else { sel.moveToFront(); return 1; }
    }
    else if (d.name == "Czechoslovakia") {
    	if (y > 1992) { sel.moveToBack(); return 0; }
    	else { sel.moveToFront(); return 1; }
    }
    else if (["North Vietnam", "South Vietnam"].indexOf(d.name) > -1) {
    	if (y < 1954 || y > 1976) { sel.moveToBack(); return 0; }
    	else { sel.moveToFront(); return 1; }
    }
    else if (d.id == "SA_Namibia") {
    	if (y < 1920 || y > 1989) { sel.moveToBack(); return 0; }
    	else { sel.moveToFront(); return 1; }
    }
    else if (d.name == "Somali Republic") {
    	if (y < 1960 || y > 1969) { sel.moveToBack(); return 0; }
    	else { sel.moveToFront(); return 1; }
    }
    else if (d.id == "China_Mongolia") {
    	if (y < 1926 || y > 1945) { sel.moveToBack(); return 0; }
    	else { sel.moveToFront(); return 1; }
    }
}

d3.selection.prototype.moveToFront = function() {
  return this.each(function(){
    this.parentNode.appendChild(this);
  });
};

d3.selection.prototype.moveToBack = function() {
    return this.each(function() {
        var firstChild = this.parentNode.firstChild;
        if (firstChild) {
            this.parentNode.insertBefore(this, firstChild);
        }
    });
};
