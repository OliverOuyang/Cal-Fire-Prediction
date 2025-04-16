import json
import os
import math

def convert_to_wgs84(x, y):
    """
    简单转换函数 - 从原始的加州坐标系统转换为WGS84
    根据数据检查结果调整参数以获得更准确的映射
    """
    # 加州边界大致为：
    # 经度：-124.409591 到 -114.131211
    # 纬度：32.534156 到 42.009518

    # 基于检查后的坐标转换参数
    lon = -124.4096 + (x + 151189) / 300000
    lat = 32.5343 + (y + 12434) / 250000
    
    # 限制在加州合理范围内
    lon = max(-124.409591, min(-114.131211, lon))
    lat = max(32.534156, min(42.009518, lat))
    
    return [lon, lat]

def fix_eco_data():
    """修复生态区域数据的坐标系统问题"""
    input_path = "static/data/ecoregions_optimized.geojson"
    output_path = "static/data/ecoregions_fixed.geojson"
    
    if not os.path.exists(input_path):
        print(f"Input file not found: {input_path}")
        return
    
    try:
        # 读取原始数据
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        features = data.get('features', [])
        print(f"Processing {len(features)} features...")
        
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
                        new_polygon = []
                        for point in polygon:
                            # 转换坐标 - 这里假设坐标已经是WGS84，但需要调整
                            # 应用适当的转换来修正显示问题
                            new_point = adjust_coordinates(point[0], point[1])
                            new_polygon.append(new_point)
                        new_polygon_group.append(new_polygon)
                    new_coords.append(new_polygon_group)
                geo['coordinates'] = new_coords
            
            elif geo_type == 'Polygon':
                # 处理Polygon
                new_coords = []
                for ring in geo.get('coordinates', []):
                    new_ring = []
                    for point in ring:
                        # 转换坐标
                        new_point = adjust_coordinates(point[0], point[1])
                        new_ring.append(new_point)
                    new_coords.append(new_ring)
                geo['coordinates'] = new_coords
            
            # 更新特征的几何
            feature['geometry'] = geo
        
        # 保存修复后的数据
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f)
        
        print(f"Saved corrected data to: {output_path}")
        print(f"File size: {os.path.getsize(output_path) / (1024*1024):.2f} MB")
        
        # 简单验证
        print("\nValidation of first feature:")
        if features:
            geo = features[0].get('geometry', {})
            geo_type = geo.get('type')
            print(f"Geometry type: {geo_type}")
            
            if geo_type == 'MultiPolygon':
                coords = geo.get('coordinates', [])
                if coords and coords[0] and coords[0][0]:
                    print("Sample corrected coordinates:")
                    for i, point in enumerate(coords[0][0][:3]):
                        print(f"  Point {i+1}: {point}")
                    
                    # 显示原始点和修正后的点的对比
                    print("\nOriginal vs Corrected coordinates:")
                    with open(input_path, 'r', encoding='utf-8') as f:
                        orig_data = json.load(f)
                    
                    if orig_data and orig_data.get('features') and orig_data['features'][0].get('geometry'):
                        orig_coords = orig_data['features'][0]['geometry']['coordinates'][0][0][:3]
                        for i, (orig, new) in enumerate(zip(orig_coords, coords[0][0][:3])):
                            print(f"  Point {i+1}: {orig} -> {new}")
        
    except Exception as e:
        import traceback
        print(f"Error fixing ecoregion data: {e}")
        traceback.print_exc()

def adjust_coordinates(lon, lat):
    """
    调整WGS84坐标以修正显示问题
    """
    # 根据原始坐标进行调整，使生态区域正确显示在加州地图上
    adjusted_lon = lon * 0.85 - 18.0  # 调整经度
    adjusted_lat = lat * 0.85 + 5.0   # 调整纬度
    
    print(f"DEBUG: Adjusted {lon},{lat} -> {adjusted_lon},{adjusted_lat}")
    return [adjusted_lon, adjusted_lat]

if __name__ == "__main__":
    print("Starting ecoregion data fix...")
    fix_eco_data()
    print("Completed processing.") 