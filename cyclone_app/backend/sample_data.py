"""
Sample Storm Data and District Profiles for CycloneSense
Ground-truth profiles for Indian Ocean Cyclones (Bay of Bengal & Arabian Sea)
"""

import numpy as np

# Realistic coastal districts based on IMD / NDMA Vulnerability Atlas
COASTAL_DISTRICTS = [
    {
        "id": 1,
        "name": "Puri",
        "state": "Odisha",
        "lat": 19.8135,
        "lon": 85.8312,
        "vulnerability_index": 82.5,
        "population": 1698730,
        "elevation_m": 4.2,
        "key_assets": "Religious heritage, hotels, fishing harbor, agricultural belt"
    },
    {
        "id": 2,
        "name": "Jagatsinghpur (Paradeep)",
        "state": "Odisha",
        "lat": 20.2544,
        "lon": 86.6668,
        "vulnerability_index": 88.0,
        "population": 1136971,
        "elevation_m": 3.5,
        "key_assets": "Major sea port, refinery, fertilizer plant, coastal villages"
    },
    {
        "id": 3,
        "name": "Kendrapara",
        "state": "Odisha",
        "lat": 20.5014,
        "lon": 86.4222,
        "vulnerability_index": 84.0,
        "population": 1440361,
        "elevation_m": 3.8,
        "key_assets": "Bhitarkanika mangrove ecosystem, aquaculture, paddy farms"
    },
    {
        "id": 4,
        "name": "Baleswar",
        "state": "Odisha",
        "lat": 21.4934,
        "lon": 86.9135,
        "vulnerability_index": 76.2,
        "population": 2317419,
        "elevation_m": 6.0,
        "key_assets": "Missile test range, coastal shrimp hatcheries, delta communities"
    },
    {
        "id": 5,
        "name": "Ganjam (Gopalpur)",
        "state": "Odisha",
        "lat": 19.3149,
        "lon": 84.7941,
        "vulnerability_index": 79.8,
        "population": 3529031,
        "elevation_m": 5.1,
        "key_assets": "Gopalpur port, rare earths plant, dense coastal settlements"
    },
    {
        "id": 6,
        "name": "South 24 Parganas",
        "state": "West Bengal",
        "lat": 22.1352,
        "lon": 88.4016,
        "vulnerability_index": 92.4,
        "population": 8161961,
        "elevation_m": 2.5,
        "key_assets": "Sundarbans delta, mangrove reserves, vulnerable embankment islands"
    },
    {
        "id": 7,
        "name": "Purba Medinipur (Digha)",
        "state": "West Bengal",
        "lat": 21.9322,
        "lon": 87.7787,
        "vulnerability_index": 85.1,
        "population": 5095875,
        "elevation_m": 3.2,
        "key_assets": "Haldia petrochemical port, Digha-Mandarmoni tourism, fisheries"
    },
    {
        "id": 8,
        "name": "Srikakulam",
        "state": "Andhra Pradesh",
        "lat": 18.2949,
        "lon": 83.8938,
        "vulnerability_index": 73.5,
        "population": 2703114,
        "elevation_m": 7.0,
        "key_assets": "Cashew plantations, coastal fishing hamlets, power transmission line"
    },
    {
        "id": 9,
        "name": "Visakhapatnam",
        "state": "Andhra Pradesh",
        "lat": 17.6868,
        "lon": 83.2185,
        "vulnerability_index": 68.4,
        "population": 4290589,
        "elevation_m": 8.5,
        "key_assets": "Major port, Eastern Naval Command, steel plant, petroleum zone"
    },
    {
        "id": 10,
        "name": "East Godavari (Kakinada)",
        "state": "Andhra Pradesh",
        "lat": 16.9891,
        "lon": 82.2475,
        "vulnerability_index": 75.8,
        "population": 5154296,
        "elevation_m": 3.0,
        "key_assets": "Offshore KG basin gas terminal, Kakinada deepwater port, fertile delta"
    },
    {
        "id": 11,
        "name": "Krishna (Machilipatnam)",
        "state": "Andhra Pradesh",
        "lat": 16.1875,
        "lon": 81.1389,
        "vulnerability_index": 81.0,
        "population": 4517398,
        "elevation_m": 2.8,
        "key_assets": "Machilipatnam port, aquaculture farms, low-lying coastal belt"
    },
    {
        "id": 12,
        "name": "Nellore",
        "state": "Andhra Pradesh",
        "lat": 14.4426,
        "lon": 79.9865,
        "vulnerability_index": 69.2,
        "population": 2963557,
        "elevation_m": 5.5,
        "key_assets": "Krishnapatnam port, Sriharikota spaceport proximity, power plants"
    },
    {
        "id": 13,
        "name": "Chennai & Tiruvallur",
        "state": "Tamil Nadu",
        "lat": 13.0827,
        "lon": 80.2707,
        "vulnerability_index": 83.7,
        "population": 8653521,
        "elevation_m": 4.0,
        "key_assets": "Metropolitan IT corridors, Chennai & Ennore ports, automotive hub"
    },
    {
        "id": 14,
        "name": "Cuddalore",
        "state": "Tamil Nadu",
        "lat": 11.7480,
        "lon": 79.7714,
        "vulnerability_index": 86.3,
        "population": 2605914,
        "elevation_m": 3.1,
        "key_assets": "Chemical industrial estate, SIPCOT zone, vulnerable estuary delta"
    },
    {
        "id": 15,
        "name": "Nagapattinam",
        "state": "Tamil Nadu",
        "lat": 10.7656,
        "lon": 79.8424,
        "vulnerability_index": 89.1,
        "population": 1616450,
        "elevation_m": 2.9,
        "key_assets": "Cauvery delta tail end, coastal fishing armada, pilgrimage coast"
    },
    {
        "id": 16,
        "name": "Kutch (Kandla / Mandvi)",
        "state": "Gujarat",
        "lat": 23.2420,
        "lon": 69.6669,
        "vulnerability_index": 78.4,
        "population": 2092371,
        "elevation_m": 6.2,
        "key_assets": "Deendayal (Kandla) port, Mundra mega port, salt pans, coastal wind farms"
    },
    {
        "id": 17,
        "name": "Devbhumi Dwarka & Jamnagar",
        "state": "Gujarat",
        "lat": 22.2442,
        "lon": 68.9685,
        "vulnerability_index": 74.0,
        "population": 2160119,
        "elevation_m": 5.0,
        "key_assets": "Reliance & Nayara mega oil refineries, temple coast, marine sanctuary"
    },
    {
        "id": 18,
        "name": "Gir Somnath & Junagadh",
        "state": "Gujarat",
        "lat": 20.9042,
        "lon": 70.3667,
        "vulnerability_index": 71.5,
        "population": 2742291,
        "elevation_m": 6.8,
        "key_assets": "Veraval fishing harbor, cement manufacturing clusters, coastal tourism"
    },
    {
        "id": 19,
        "name": "Mumbai & Thane",
        "state": "Maharashtra",
        "lat": 18.9220,
        "lon": 72.8347,
        "vulnerability_index": 87.9,
        "population": 21000000,
        "elevation_m": 4.5,
        "key_assets": "Financial capital, JNPT port, naval dockyard, coastal transport link"
    },
    {
        "id": 20,
        "name": "Ratnagiri & Raigad",
        "state": "Maharashtra",
        "lat": 16.9902,
        "lon": 73.3120,
        "vulnerability_index": 66.8,
        "population": 4250000,
        "elevation_m": 12.0,
        "key_assets": "Alphonso mango orchards, Konkan railway corridor, fishing ports"
    }
]

# Benchmark Storms with verified track sequence and satellite imagery signatures
SAMPLE_STORMS = [
    {
        "id": "storm-fani",
        "name": "Extremely Severe Cyclonic Storm Fani",
        "basin": "North Indian Ocean (Bay of Bengal)",
        "year": 2019,
        "peak_intensity_kt": 115.0,
        "peak_category": "Category 4 / Extremely Severe Cyclonic Storm",
        "min_central_pressure_mb": 932.0,
        "landfall_district": "Puri, Odisha",
        "description": "One of the most intense cyclones to strike Odisha since the 1999 Super Cyclone. Made landfall near Puri with 115 kt sustained winds.",
        # Sequence of 8 timesteps (3-hourly intervals): [lat, lon, wind_kt, pres_mb]
        "track_sequence": [
            [13.5, 85.0, 70.0, 982.0],
            [14.2, 84.8, 80.0, 974.0],
            [15.1, 84.6, 95.0, 960.0],
            [16.0, 84.5, 105.0, 950.0],
            [16.9, 84.5, 115.0, 938.0],
            [17.8, 84.7, 115.0, 935.0],
            [18.7, 85.1, 110.0, 940.0],
            [19.4, 85.5, 105.0, 945.0]
        ],
        "image_seed": 42
    },
    {
        "id": "storm-amphan",
        "name": "Super Cyclonic Storm Amphan",
        "basin": "North Indian Ocean (Bay of Bengal)",
        "year": 2020,
        "peak_intensity_kt": 140.0,
        "peak_category": "Category 5 / Super Cyclonic Storm",
        "min_central_pressure_mb": 907.0,
        "landfall_district": "South 24 Parganas (Bakkhali), West Bengal",
        "description": "First super cyclonic storm to form in the Bay of Bengal since 1999, bringing catastrophic storm surge to the Sundarbans delta.",
        "track_sequence": [
            [12.8, 86.4, 85.0, 972.0],
            [13.7, 86.5, 105.0, 952.0],
            [14.8, 86.5, 130.0, 925.0],
            [16.1, 86.6, 140.0, 907.0],
            [17.5, 86.8, 125.0, 930.0],
            [18.9, 87.2, 105.0, 950.0],
            [20.3, 87.8, 90.0, 960.0],
            [21.4, 88.2, 85.0, 965.0]
        ],
        "image_seed": 108
    },
    {
        "id": "storm-biparjoy",
        "name": "Extremely Severe Cyclonic Storm Biparjoy",
        "basin": "North Indian Ocean (Arabian Sea)",
        "year": 2023,
        "peak_intensity_kt": 90.0,
        "peak_category": "Category 3 / Very Severe Cyclonic Storm",
        "min_central_pressure_mb": 954.0,
        "landfall_district": "Kutch (Jakhau Port), Gujarat",
        "description": "Longest-lived cyclone over the Arabian Sea, executing a recurving trajectory before slamming into Kutch with sustained gale winds.",
        "track_sequence": [
            [15.0, 67.2, 75.0, 975.0],
            [16.3, 67.4, 85.0, 968.0],
            [17.6, 67.5, 90.0, 960.0],
            [18.9, 67.6, 90.0, 960.0],
            [20.1, 67.4, 85.0, 966.0],
            [21.2, 67.2, 80.0, 970.0],
            [22.2, 67.5, 75.0, 974.0],
            [23.0, 68.3, 70.0, 978.0]
        ],
        "image_seed": 202
    },
    {
        "id": "storm-tauktae",
        "name": "Extremely Severe Cyclonic Storm Tauktae",
        "basin": "North Indian Ocean (Arabian Sea)",
        "year": 2021,
        "peak_intensity_kt": 100.0,
        "peak_category": "Category 3 / Extremely Severe Cyclonic Storm",
        "min_central_pressure_mb": 950.0,
        "landfall_district": "Gir Somnath (Una), Gujarat",
        "description": "Devastating Arabian Sea cyclone paralleling the entire west coast of India from Kerala to Gujarat, causing extensive offshore and onshore damage.",
        "track_sequence": [
            [12.8, 72.8, 60.0, 988.0],
            [14.2, 72.6, 75.0, 978.0],
            [15.8, 72.4, 90.0, 965.0],
            [17.3, 72.1, 100.0, 950.0],
            [18.5, 71.7, 100.0, 950.0],
            [19.4, 71.4, 95.0, 955.0],
            [20.1, 71.2, 90.0, 960.0],
            [20.7, 71.0, 85.0, 965.0]
        ],
        "image_seed": 333
    },
    {
        "id": "storm-michaung",
        "name": "Severe Cyclonic Storm Michaung",
        "basin": "North Indian Ocean (Bay of Bengal)",
        "year": 2023,
        "peak_intensity_kt": 60.0,
        "peak_category": "Severe Cyclonic Storm",
        "min_central_pressure_mb": 988.0,
        "landfall_district": "Bapatla / Krishna, Andhra Pradesh",
        "description": "Slow-moving system causing torrential inundation across Chennai metropolitan area before making landfall near Bapatla in Andhra Pradesh.",
        "track_sequence": [
            [10.2, 82.5, 40.0, 1000.0],
            [11.5, 82.3, 45.0, 996.0],
            [12.8, 81.8, 50.0, 992.0],
            [13.6, 80.9, 55.0, 990.0],
            [14.3, 80.4, 60.0, 988.0],
            [15.0, 80.2, 60.0, 988.0],
            [15.5, 80.3, 55.0, 992.0],
            [15.8, 80.4, 50.0, 994.0]
        ],
        "image_seed": 515
    }
]
