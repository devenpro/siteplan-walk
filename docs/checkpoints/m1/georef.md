# M1 georef: how to check it on your phone

Status: **PROVISIONAL, about 150 m.** One place pin (13.0477816, 77.7495055) is taken as the entrance gate, and the plan supplies its own scale (0.343 m/px) and north (135 degrees). The pin sits on Budigere Road, so it fixes the frontage but not which side of the road the plot is on. See https://mockups.csoul.cloud/walk-m1-osm.png for the OSM overlay.

Open each link in satellite view. The map centre is where the viewer thinks that spot is.

| Spot | Map link | Expected on the ground |
|---|---|---|
| Entrance gate (the anchor: your Google pin) | [13.047782, 77.749505](https://www.google.com/maps/@?api=1&map_action=map&center=13.047782,77.749505&zoom=18&basemap=satellite) | the gate on the main road |
| Plot centre | [13.046946, 77.748587](https://www.google.com/maps/@?api=1&map_action=map&center=13.046946,77.748587&zoom=18&basemap=satellite) | inside the construction site |
| Tower A centre | [13.046043, 77.748289](https://www.google.com/maps/@?api=1&map_action=map&center=13.046043,77.748289&zoom=18&basemap=satellite) | a tower pit/crane |
| Tower B centre | [13.046651, 77.747731](https://www.google.com/maps/@?api=1&map_action=map&center=13.046651,77.747731&zoom=18&basemap=satellite) | a tower pit/crane |
| Far corner of the plot (plan top-left, A) | [13.045524, 77.748244](https://www.google.com/maps/@?api=1&map_action=map&center=13.045524,77.748244&zoom=18&basemap=satellite) | the far plot corner |
| Far corner of the plot (plan top-right, B) | [13.046740, 77.747048](https://www.google.com/maps/@?api=1&map_action=map&center=13.046740,77.747048&zoom=18&basemap=satellite) | the far plot corner |

The plot centre is 136 m from the pin. If the links land on the wrong side of the road, or the footprint is clearly offset, send 3 corner pins (A, B, C or D at https://mockups.csoul.cloud/walk-m1-pins.png) and the georef becomes verified.
