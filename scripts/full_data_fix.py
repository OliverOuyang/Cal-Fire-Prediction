import json
import os
import math
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

def convert_to_wgs84(x, y):
    """
    简单转换函数 - 这里使用简单线性变换估算
    实际项目中应使用专业的坐标转换库如pyproj
    """
    # 加州大致坐标范围
    # 大致估算，仅用于演示
    lon = -124.4096 + (x / 1000000) * 10.4
    lat = 32.5343 + (y / 1000000) * 9.5
    
    # 限制在合理范围内
    lon = max(-124.4096, min(-114.1308, lon))
    lat = max(32.5343, min(42.0095, lat))
    
    return [lon, lat]

def advanced_simplify_geometry(geometry, precision=5, sample_rate=1.0):
    """高级简化几何数据，减少精度并采样点"""
    if not geometry:
        return
    
    geo_type = geometry.get("type")
    
    if geo_type == "Point":
        coordinates = geometry.get("coordinates", [])
        if coordinates:
            geometry["coordinates"] = [round(coordinates[0], precision), round(coordinates[1], precision)]
    
    elif geo_type in ["LineString", "MultiPoint"]:
        # 随机采样点
        coords = geometry.get("coordinates", [])
        if sample_rate < 1.0 and len(coords) > 10:
            # 采样点，但确保保留前后点
            sample_size = max(10, int(len(coords) * sample_rate))
            sampled_indices = sorted(random.sample(range(1, len(coords)-1), sample_size-2))
            sampled_coords = [coords[0]] + [coords[i] for i in sampled_indices] + [coords[-1]]
            geometry["coordinates"] = sampled_coords
        
        # 减少精度
        for i, point in enumerate(geometry.get("coordinates", [])):
            if point:
                geometry["coordinates"][i] = [round(point[0], precision), round(point[1], precision)]
    
    elif geo_type in ["Polygon", "MultiLineString"]:
        for i, line in enumerate(geometry.get("coordinates", [])):
            # 随机采样点
            if sample_rate < 1.0 and len(line) > 10:
                # 采样点，但确保保留前后点（对于多边形，首尾点需相同）
                sample_size = max(10, int(len(line) * sample_rate))
                if geo_type == "Polygon":
                    # 确保首尾相同
                    sampled_indices = sorted(random.sample(range(1, len(line)-1), sample_size-2))
                    sampled_line = [line[0]] + [line[i] for i in sampled_indices] + [line[0]]
                else:
                    sampled_indices = sorted(random.sample(range(1, len(line)-1), sample_size-2))
                    sampled_line = [line[0]] + [line[i] for i in sampled_indices] + [line[-1]]
                geometry["coordinates"][i] = sampled_line
            
            # 减少精度
            for j, point in enumerate(geometry["coordinates"][i]):
                geometry["coordinates"][i][j] = [round(point[0], precision), round(point[1], precision)]
    
    elif geo_type == "MultiPolygon":
        for i, polygon in enumerate(geometry.get("coordinates", [])):
            for j, ring in enumerate(polygon):
                # 随机采样点
                if sample_rate < 1.0 and len(ring) > 10:
                    # 采样点，但确保保留首尾点（对于多边形，首尾点需相同）
                    sample_size = max(10, int(len(ring) * sample_rate))
                    # 确保首尾相同
                    sampled_indices = sorted(random.sample(range(1, len(ring)-1), sample_size-2))
                    sampled_ring = [ring[0]] + [ring[k] for k in sampled_indices] + [ring[0]]
                    geometry["coordinates"][i][j] = sampled_ring
                
                # 减少精度
                for k, point in enumerate(geometry["coordinates"][i][j]):
                    geometry["coordinates"][i][j][k] = [round(point[0], precision), round(point[1], precision)]

def optimize_fire_data():
    """优化火灾数据，减小文件大小同时保留所有特征"""
    input_path = "static/data/fires_filtered.geojson"
    output_path = "static/data/fires_optimized.geojson"
    
    if not os.path.exists(input_path):
        print(f"Input file not found: {input_path}")
        return
    
    try:
        # 读取数据
        print(f"Reading fire data from {input_path}...")
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        features = data.get('features', [])
        feature_count = len(features)
        print(f"Processing {feature_count} fire features...")
        
        # 使用高级简化方法优化每个特征
        for i, feature in enumerate(features):
            if i % 1000 == 0:
                print(f"Processed {i}/{feature_count} features...")
                
            # 简化几何数据 - 使用高级方法
            if "geometry" in feature and feature["geometry"]:
                # 根据多边形点的数量决定采样率
                geo = feature["geometry"]
                point_count = 0
                
                if geo.get("type") == "Polygon":
                    for ring in geo.get("coordinates", []):
                        point_count += len(ring)
                elif geo.get("type") == "MultiPolygon":
                    for polygon in geo.get("coordinates", []):
                        for ring in polygon:
                            point_count += len(ring)
                
                # 采样率基于点数量
                sample_rate = 1.0  # 默认不采样
                if point_count > 1000:
                    sample_rate = 0.1  # 非常大的多边形
                elif point_count > 500:
                    sample_rate = 0.2
                elif point_count > 200:
                    sample_rate = 0.5
                
                advanced_simplify_geometry(geo, precision=5, sample_rate=sample_rate)
        
        # 保存优化后的数据
        print(f"Saving optimized fire data to {output_path}...")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f)
        
        print(f"Original file size: {os.path.getsize(input_path) / (1024*1024):.2f} MB")
        print(f"Optimized file size: {os.path.getsize(output_path) / (1024*1024):.2f} MB")
        
    except Exception as e:
        print(f"Error optimizing fire data: {e}")

def fix_eco_data_wgs84():
    """修复生态区域数据的坐标系统问题，转换为WGS84"""
    input_path = "static/data/ecoregions_filtered.geojson"
    output_path = "static/data/ecoregions_optimized.geojson"
    
    if not os.path.exists(input_path):
        print(f"Input file not found: {input_path}")
        return
    
    try:
        # 读取数据
        print(f"Reading ecoregion data from {input_path}...")
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        features = data.get('features', [])
        print(f"Processing {len(features)} ecoregion features...")
        
        # 处理每个特征
        for feature in features:
            geo = feature.get('geometry', {})
            geo_type = geo.get('type')
            
            if geo_type == 'MultiPolygon':
                # 处理MultiPolygon
                new_coords = []
                for polygon_group in geo.get('coordinates', []):
                    new_polygon_group = []
                    for polygon in polygon_group:
                        # 对于大多边形，进行点采样
                        if len(polygon) > 1000:
                            sample_rate = 0.05
                        elif len(polygon) > 500:
                            sample_rate = 0.1
                        elif len(polygon) > 200:
                            sample_rate = 0.2
                        else:
                            sample_rate = 1.0
                            
                        if sample_rate < 1.0:
                            # 采样点，但确保保留首尾点（对于多边形，首尾点需相同）
                            sample_size = max(20, int(len(polygon) * sample_rate))
                            sampled_indices = sorted(random.sample(range(1, len(polygon)-1), sample_size-2))
                            sampled_polygon = [polygon[0]] + [polygon[i] for i in sampled_indices] + [polygon[0]]
                            polygon = sampled_polygon
                        
                        new_polygon = []
                        for point in polygon:
                            # 转换坐标
                            new_point = convert_to_wgs84(point[0], point[1])
                            new_polygon.append(new_point)
                        new_polygon_group.append(new_polygon)
                    new_coords.append(new_polygon_group)
                geo['coordinates'] = new_coords
            
            elif geo_type == 'Polygon':
                # 处理Polygon
                new_coords = []
                for ring in geo.get('coordinates', []):
                    # 对于大环，进行点采样
                    if len(ring) > 1000:
                        sample_rate = 0.05
                    elif len(ring) > 500:
                        sample_rate = 0.1
                    elif len(ring) > 200:
                        sample_rate = 0.2
                    else:
                        sample_rate = 1.0
                        
                    if sample_rate < 1.0:
                        # 采样点，但确保保留首尾点相同
                        sample_size = max(20, int(len(ring) * sample_rate))
                        sampled_indices = sorted(random.sample(range(1, len(ring)-1), sample_size-2))
                        sampled_ring = [ring[0]] + [ring[i] for i in sampled_indices] + [ring[0]]
                        ring = sampled_ring
                    
                    new_ring = []
                    for point in ring:
                        # 转换坐标
                        new_point = convert_to_wgs84(point[0], point[1])
                        new_ring.append(new_point)
                    new_coords.append(new_ring)
                geo['coordinates'] = new_coords
            
            # 更新特征的几何
            feature['geometry'] = geo
        
        # 保存修复后的数据
        print(f"Saving optimized ecoregion data to {output_path}...")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f)
        
        print(f"Original file size: {os.path.getsize(input_path) / (1024*1024):.2f} MB")
        print(f"Optimized file size: {os.path.getsize(output_path) / (1024*1024):.2f} MB")
        
        # 简单验证
        print("\nValidation of first feature:")
        if features:
            geo = features[0].get('geometry', {})
            geo_type = geo.get('type')
            print(f"Geometry type: {geo_type}")
            
            if geo_type == 'MultiPolygon':
                coords = geo.get('coordinates', [])
                if coords and coords[0] and coords[0][0]:
                    print("Sample converted coordinates:")
                    for i, point in enumerate(coords[0][0][:3]):
                        print(f"  Point {i}: {point}")
        
    except Exception as e:
        print(f"Error fixing ecoregion data: {e}")

def main():
    # 优化火灾数据
    print("=== OPTIMIZING FIRE DATA ===")
    optimize_fire_data()
    
    # 优化生态区域数据
    print("\n=== OPTIMIZING ECOREGION DATA ===")
    fix_eco_data_wgs84()

if __name__ == "__main__":
    main() 