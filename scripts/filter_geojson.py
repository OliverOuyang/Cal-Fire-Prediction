import json
import os
import datetime
import random

def read_geojson_file(file_path):
    """读取GeoJSON文件并返回其内容"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data
    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
        return None

def save_geojson_file(data, file_path):
    """保存GeoJSON数据到文件"""
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f)
        print(f"Saved file: {file_path}")
        print(f"File size: {os.path.getsize(file_path) / (1024*1024):.2f} MB")
    except Exception as e:
        print(f"Error saving file {file_path}: {e}")

def filter_fire_data(data, max_features=None, years=None, include_counties=None):
    """
    筛选火灾数据，保留所有特征但精简属性和几何数据
    
    参数:
        data: GeoJSON数据
        max_features: 最大特征数量（如果为None，保留所有特征）
        years: 要包含的年份列表（如果为None，则包含所有年份）
        include_counties: 要包含的县列表（如果为None，则包含所有县）
    """
    if not data or "features" not in data:
        return data
    
    # 收集所有可用的年份和县
    all_years = set()
    all_counties = set()
    
    for feature in data["features"]:
        props = feature.get("properties", {})
        year = props.get("YEAR_")
        county = props.get("UNIT_ID")
        
        if year:
            all_years.add(year)
        if county:
            all_counties.add(county)
    
    print(f"Original data contains {len(data['features'])} features")
    print(f"Years range from {min(all_years) if all_years else 'unknown'} to {max(all_years) if all_years else 'unknown'}")
    print(f"Found {len(all_counties)} unique counties")
    
    filtered_features = []
    
    # 如果没有指定年份，使用所有年份
    if not years:
        years = list(all_years)
    
    # 确保counties是列表或None
    counties_to_include = include_counties if include_counties else list(all_counties)
    
    # 处理所有特征
    for feature in data["features"]:
        props = feature.get("properties", {})
        year = props.get("YEAR_")
        county = props.get("UNIT_ID")
        
        # 应用年份和县过滤（如果指定）
        if years and year not in years:
            continue
        if counties_to_include and county not in counties_to_include:
            continue
            
        # 简化几何数据 - 减少精度
        if "geometry" in feature and feature["geometry"]:
            simplify_geometry(feature["geometry"], precision=5)  # 增加精度保留小数位数
        
        # 只保留必要的属性
        essential_props = {
            "OBJECTID": props.get("OBJECTID"),
            "YEAR_": props.get("YEAR_"),
            "FIRE_NAME": props.get("FIRE_NAME"),
            "ALARM_DATE": props.get("ALARM_DATE"),
            "CONT_DATE": props.get("CONT_DATE"),
            "UNIT_ID": props.get("UNIT_ID"),
            "CAUSE": props.get("CAUSE"),
            "ACRES": props.get("ACRES")
        }
        feature["properties"] = essential_props
        
        filtered_features.append(feature)
        
        # 如果指定了最大特征数量并达到该数量，停止添加
        if max_features and len(filtered_features) >= max_features:
            break
    
    print(f"Filtered to {len(filtered_features)} features")
    
    # 创建新的GeoJSON对象
    filtered_data = {
        "type": data["type"],
        "features": filtered_features
    }
    
    return filtered_data

def filter_ecoregion_data(data):
    """筛选生态区域数据，简化几何形状和属性"""
    if not data or "features" not in data:
        return data
    
    print(f"Original ecoregion data contains {len(data['features'])} features")
    
    filtered_features = []
    
    for feature in data["features"]:
        # 简化几何数据
        if "geometry" in feature and feature["geometry"]:
            simplify_geometry(feature["geometry"])
        
        # 只保留必要的属性
        if "properties" in feature:
            props = feature["properties"]
            essential_props = {
                "OBJECTID": props.get("OBJECTID"),
                "ECOREGION_SECTION": props.get("ECOREGION_SECTION"),
                "Ecoregion_Acres": props.get("Ecoregion_Acres")
            }
            feature["properties"] = essential_props
        
        filtered_features.append(feature)
    
    # 创建新的GeoJSON对象
    filtered_data = {
        "type": data["type"],
        "features": filtered_features
    }
    
    return filtered_data

def simplify_geometry(geometry, precision=5):
    """简化几何数据，减少精度"""
    if not geometry:
        return
    
    geo_type = geometry.get("type")
    
    if geo_type == "Point":
        coordinates = geometry.get("coordinates", [])
        if coordinates:
            geometry["coordinates"] = [round(coordinates[0], precision), round(coordinates[1], precision)]
    
    elif geo_type in ["LineString", "MultiPoint"]:
        for i, point in enumerate(geometry.get("coordinates", [])):
            if point:
                geometry["coordinates"][i] = [round(point[0], precision), round(point[1], precision)]
    
    elif geo_type in ["Polygon", "MultiLineString"]:
        for i, line in enumerate(geometry.get("coordinates", [])):
            for j, point in enumerate(line):
                geometry["coordinates"][i][j] = [round(point[0], precision), round(point[1], precision)]
    
    elif geo_type == "MultiPolygon":
        for i, polygon in enumerate(geometry.get("coordinates", [])):
            for j, line in enumerate(polygon):
                for k, point in enumerate(line):
                    geometry["coordinates"][i][j][k] = [round(point[0], precision), round(point[1], precision)]

def main():
    # 源文件路径
    fire_geojson = "FireGeoData/California_Fire_Perimeters_(all).geojson"
    eco_geojson = "FireGeoData/USDA_Ecoregion_Sections_07_3__California_1181756670207107930.geojson"
    
    # 输出文件路径
    output_dir = "static/data"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    fire_output = os.path.join(output_dir, "fires_filtered.geojson")
    eco_output = os.path.join(output_dir, "ecoregions_filtered.geojson")
    
    # 处理火灾数据
    print("Processing fire data...")
    fire_data = read_geojson_file(fire_geojson)
    if fire_data:
        # 保留所有年份的数据，不限制特征数量
        filtered_fire_data = filter_fire_data(fire_data)
        if filtered_fire_data:
            save_geojson_file(filtered_fire_data, fire_output)
    
    # 处理生态区域数据
    print("\nProcessing ecoregion data...")
    eco_data = read_geojson_file(eco_geojson)
    if eco_data:
        filtered_eco_data = filter_ecoregion_data(eco_data)
        if filtered_eco_data:
            save_geojson_file(filtered_eco_data, eco_output)

if __name__ == "__main__":
    main() 