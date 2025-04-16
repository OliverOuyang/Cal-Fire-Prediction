import os
import json
import base64
from datetime import datetime
from openai import OpenAI
from dotenv import load_dotenv

# Load API key from environment variables
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OpenAI API key not found. Please set OPENAI_API_KEY environment variable.")

# Create OpenAI client
client = OpenAI(api_key=api_key)

# Path to local image
image_path = "static/uploads/infrared-satellite-imagery-dixie-fire-greenville-california.jpg"
if not os.path.exists(image_path):
    raise FileNotFoundError(f"Image not found at: {image_path}")

print(f"Analyzing local image: {image_path}")

# Read and encode image
with open(image_path, "rb") as image_file:
    base64_image = base64.b64encode(image_file.read()).decode('utf-8')

# Call OpenAI API
try:
    print("Calling OpenAI API...")
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system", 
                "content": "You are an expert in satellite image analysis. Provide concise observations of visible features."
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text", 
                        "text": "Analyze this infrared satellite image. Provide brief observations for:\n1) Vegetation (density, types)\n2) Topography\n3) Burn patterns\n4) Smoke/heat signatures\n\nKeep responses concise and objective."
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        }
                    }
                ]
            }
        ],
        max_tokens=500
    )
    
    # Extract analysis
    analysis = response.choices[0].message.content
    
    # Save results to JSON
    result = {
        "analysis": analysis,
        "image_path": image_path,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    
    output_file = f"local_fire_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
        
    print(f"Analysis saved to: {output_file}")
    
    # Print analysis
    print("\n===== Satellite Image Analysis =====\n")
    print(analysis)
    
except Exception as e:
    print(f"Error: {e}")