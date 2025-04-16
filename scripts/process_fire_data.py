#!/usr/bin/env python
import json
import os
from datetime import datetime
import re

def load_geojson_in_chunks(file_path, chunk_size=1024*1024*10):  # 10MB chunks
    """Load a large GeoJSON file in chunks and parse it incrementally."""
    fire_features = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        # Read and parse the header
        header = ""
        while True:
            char = f.read(1)
            header += char
            if header.endswith('"features": ['):
                break
        
        # Now read features one by one
        feature_str = ""
        open_braces = 0
        in_feature = False
        
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
                
            for char in chunk:
                if not in_feature and char == '{':
                    in_feature = True
                
                if in_feature:
                    feature_str += char
                    if char == '{':
                        open_braces += 1
                    elif char == '}':
                        open_braces -= 1
                        
                    if open_braces == 0:
                        # We've found a complete feature
                        try:
                            feature = json.loads(feature_str)
                            fire_features.append(feature)
                        except json.JSONDecodeError:
                            print(f"Error parsing feature: {feature_str[:100]}...")
                        
                        feature_str = ""
                        in_feature = False
                        
                        # Skip the comma and whitespace
                        while True:
                            next_char = f.read(1)
                            if not next_char or next_char == '{':
                                if next_char == '{':
                                    feature_str = '{'
                                    open_braces = 1
                                    in_feature = True
                                break
    
    return fire_features

def extract_year_from_date(date_str):
    """Extract year from date string in various formats."""
    if not date_str:
        return None
    
    # Try ISO format with Z (UTC)
    if 'T' in date_str and date_str.endswith('Z'):
        try:
            return datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%SZ").year
        except ValueError:
            pass
    
    # Try other formats
    formats = [
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%m/%d/%Y",
        "%d/%m/%Y"
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).year
        except ValueError:
            continue
    
    # Last resort: try to extract year with regex
    year_match = re.search(r'(\d{4})', date_str)
    if year_match:
        return int(year_match.group(1))
    
    return None

def process_fire_data(input_file, output_file):
    """Process fire perimeter data and output a simplified version."""
    print(f"Processing {input_file}...")
    
    # Process fire features in chunks
    features = load_geojson_in_chunks(input_file)
    
    # Process and filter features
    processed_features = []
    
    # Track counties and years for dropdown options
    counties = set()
    years = set()
    
    for feature in features:
        props = feature.get('properties', {})
        
        # Extract key information
        year = props.get('YEAR_')
        if not year and 'ALARM_DATE' in props:
            year = extract_year_from_date(props['ALARM_DATE'])
        
        county = props.get('COUNTY', '')  # Some datasets might have county information
        fire_name = props.get('FIRE_NAME', '')
        acres = props.get('GIS_ACRES', 0)
        
        # Only include essential properties
        simplified_props = {
            'id': props.get('OBJECTID', len(processed_features) + 1),
            'fire_name': fire_name,
            'year': year,
            'county': county,
            'acres': acres,
            'alarm_date': props.get('ALARM_DATE', ''),
            'cont_date': props.get('CONT_DATE', ''),
            'cause': props.get('CAUSE', '')
        }
        
        # Add to tracking sets
        if county:
            counties.add(county)
        if year:
            years.add(year)
        
        # Create simplified feature
        simplified_feature = {
            'type': 'Feature',
            'properties': simplified_props,
            'geometry': feature.get('geometry', {})
        }
        
        processed_features.append(simplified_feature)
    
    # Create output GeoJSON
    output_geojson = {
        'type': 'FeatureCollection',
        'metadata': {
            'counties': sorted(list(counties)),
            'years': sorted(list(years))
        },
        'features': processed_features
    }
    
    # Write output
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_geojson, f)
    
    print(f"Processed {len(processed_features)} features")
    print(f"Output written to {output_file}")

def process_ecoregion_data(input_file, output_file):
    """Process ecoregion data and output a simplified version."""
    print(f"Processing {input_file}...")
    
    # Process ecoregion features
    features = load_geojson_in_chunks(input_file)
    
    # Process and filter features
    processed_features = []
    
    # Track ecoregions for dropdown options
    ecoregions = set()
    
    for feature in features:
        props = feature.get('properties', {})
        
        # Extract key information
        eco_section = props.get('S_NAME', '')
        eco_code = props.get('S_CODE', '')
        
        # Only include essential properties
        simplified_props = {
            'id': props.get('OBJECTID', len(processed_features) + 1),
            'eco_section': eco_section,
            'eco_code': eco_code
        }
        
        # Add to tracking sets
        if eco_section:
            ecoregions.add(eco_section)
        
        # Create simplified feature
        simplified_feature = {
            'type': 'Feature',
            'properties': simplified_props,
            'geometry': feature.get('geometry', {})
        }
        
        processed_features.append(simplified_feature)
    
    # Create output GeoJSON
    output_geojson = {
        'type': 'FeatureCollection',
        'metadata': {
            'ecoregions': sorted(list(ecoregions))
        },
        'features': processed_features
    }
    
    # Write output
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_geojson, f)
    
    print(f"Processed {len(processed_features)} ecoregion features")
    print(f"Output written to {output_file}")

if __name__ == "__main__":
    # Create output directory if it doesn't exist
    os.makedirs('static/data', exist_ok=True)
    
    # Process fire perimeter data
    fire_input = "FireGeoData/California_Fire_Perimeters_(all).geojson"
    fire_output = "static/data/california_fires_processed.geojson"
    process_fire_data(fire_input, fire_output)
    
    # Process ecoregion data
    eco_input = "FireGeoData/USDA_Ecoregion_Sections_07_3__California_1181756670207107930.geojson"
    eco_output = "static/data/california_ecoregions_processed.geojson"
    process_ecoregion_data(eco_input, eco_output) 