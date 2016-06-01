var formatNumber   = d3.format("$.0f"),
    formatBillion  = function(x) { return formatNumber(x / 1e9) + "B"; },
    formatMillion  = function(x) { return formatNumber(x / 1e6) + "M"; },
    formatThousand = function(x) { return formatNumber(x / 1e3) + "k"; };

var formatAbbreviation = function(x) {
    var v = Math.abs(x);
    return (v >= .9995e9 ? formatBillion
            : v >= .9995e6 ? formatMillion
            : formatThousand)(x);
}

// define svg parameters
var width = 1000,
    height = 600,
    magnifier = 50,
    formatNumber = d3.format(",.0f");

var comps = {'y1955': null, 'y2015': null};

//Define mapping method
var projection = d3.geo.albersUsa()
    .scale(1100)
    .translate([width / 2, height / 2]);

var path = d3.geo.path()
    .projection(projection);
    
var svgs = {'y1955': d3.select("#map-1955").append("svg").attr("width", width).attr("height", height), 
			'y2015': d3.select("#map-2015").append("svg").attr("width", width).attr("height", height)};

// dimensions
var xdata = {},
	all_group = {},
	companies = {},
	firms = {},
	industries = {};

//Create legend for industries
var SICs = ['Business Services',
			'Chemicals and Allied Products',
			'Communications',
			'Depository Institutions',
            'Electric and Electronic Equipment',
            'Food and Kindred Products',
            'General Merchandise Stores',
            'Industrial/Commercial Machinery and Computer Equipment',
            'Insurance Carriers',
            'Machinery, Except Electrical',
            'Miscellaneous Manufacturing Industries',
            'Miscellaneous Retail',
            'Motor Vehicle Parts and Accessories',
            'Oil and Gas Extraction',
            'Other',
            'Paper and Allied Products',
            'Petroleum and Coal Products',
            'Primary Metal Industries',
            'Transportation Equipment',
            'Wholesale Trade Nondurable Goods'];

var sicCharts = {'y1955': dc.rowChart("#sic-chart-1955", "1955"),
				 'y2015': dc.rowChart("#sic-chart-2015", "2015")};

// Initialize tooltip
var probes = {'y1955': d3.select("#map-1955").append("div").attr("class", "probe"), 
			  'y2015': d3.select("#map-2015").append("div").attr("class", "probe")};

// color scale
var z = d3.scale.category20().domain(SICs);

d3.json("../../topology/us.json", function(error, us) {
    if (error) throw error;

	var temp = ['y1955','y2015'];
	for (var x in temp) {
	    // create border on the map
	    svgs[temp[x]].insert("path", ".graticule")
	        .datum(topojson.feature(us, us.objects.land))
	        .attr("class", "land")
	        .attr("d", path);
	
	    svgs[temp[x]].insert("path", ".graticule")
	        .datum(topojson.mesh(us, us.objects.states, function(a, b) { return a !== b; }))
	        .attr("class", "state-boundary")
	        .attr("d", path);
	}
    
    d3.csv("data/rev-1955.csv", function(d) {
        var p = projection([+d.longitude, +d.latitude]);
        if (p === null) console.log(d);
        return {
            id: d.id,
            company: d.company,
            rev: +d.rev,
            norm_rev: +d.norm_rev,
            SIC: d.SIC,
            lat: +d.latitude,
            lon: +d.longitude,
            cx: p[0],
            cy: p[1]
        };
    }, function(error, data) {
        if (error) throw error;
        
        comps.y1955 = data;
        xdata.y1955 = crossfilter(data);
        all_group.y1955 = xdata.y1955.groupAll();

        // define Crossfilter dimensions
        companies.y1955 = xdata.y1955.dimension(function(d){ return d.company; });
        industries.y1955 = xdata.y1955.dimension(function(d){ return d.SIC; });
        
        drawMap('y1955');
	        
	    sicCharts.y1955
			.width($('#sic-chart-1955').width())
			.height(450)
			.colors(function(sic) { return z(sic); })
			.margins({top: 10, left: 20, right: 10, bottom: 20})
			.group(industries.y1955.group())
			.dimension(industries.y1955)
			.elasticX(true)
			.on("filtered", function() { drawMap('y1955'); });

		dc.renderAll("1955");

    });
    
    d3.csv("data/rev-2015.csv", function(d) {
        var p = projection([+d.longitude, +d.latitude]);
        if (p === null) console.log(d);
        return {
            id: d.id,
            company: d.company,
            rev: +d.rev,
            norm_rev: +d.norm_rev,
            SIC: d.SIC,
            lat: +d.latitude,
            lon: +d.longitude,
            cx: p[0],
            cy: p[1]
        };
    }, function(error, data) {
        if (error) throw error;
        
        comps.y2015 = data;
        xdata.y2015 = crossfilter(data);
        all_group.y2015 = xdata.y2015.groupAll();

        // define Crossfilter dimensions
        companies.y2015 = xdata.y2015.dimension(function(d){ return d.company; });
        industries.y2015 = xdata.y2015.dimension(function(d){ return d.SIC; });
        
        drawMap('y2015');
        	        
	    sicCharts.y2015
			.width($('#sic-chart-2015').width())
			.height(450)
			.colors(function(sic) { return z(sic); })
			.margins({top: 10, left: 20, right: 10, bottom: 20})
			.group(industries.y2015.group())
			.dimension(industries.y2015)
			.elasticX(true)
			.on("filtered", function() { drawMap('y2015'); });
	
		dc.renderAll("2015");

    });
});

function drawMap(y) {

    var subset = companies[y].top(Infinity).sort(function(a, b){ return b.norm_rev - a.norm_rev; });

    // SELECT all bubbles for this map
    var bubbles = svgs[y].selectAll(".bubble")
        .data(subset, function(d) { return d.id; });

    // ENTER
    bubbles.enter().append("circle")
        .attr("r", 0)
        .attr("class", "bubble")
        .attr("fill", function(d) { return z(d.SIC); })
        .attr("id", function(d) { return d.id; })
        .attr("cx", function(d) { return d.cx; })
        .attr("cy", function(d) { return d.cy; })
      .transition() // transition only applies to attributes after this
        .ease("linear")
        .duration(500)
        .attr("r", function(d) { return magnifier * Math.sqrt(d.norm_rev); });
        
    // ENTER & UPDATE
    bubbles
        .order() // sort again so small circles on top
        .on("mouseover", function(d) {
            probes[y].style({
                "display": "block",
                "top":  (d.cy - 100) + "px",
                "left": (d.cx + 10) + "px"
            })
            .html(d.company + "<br>$" + formatAbbreviation(d.rev) + " revenue");
        })
        .on("mouseout", function() { probes[y].style("display", "none"); });
        
    // EXIT
    bubbles.exit().transition()
        .ease("linear")
        .duration(500)
        .attr("r", 0)
        .remove();

}
