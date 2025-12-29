import os
from PIL import Image

def resize_icons():
    source_icon = 'icon.png'
    sizes = [16, 48, 128]
    
    if not os.path.exists(source_icon):
        print(f"Error: {source_icon} not found.")
        return

    try:
        with Image.open(source_icon) as img:
            for size in sizes:
                new_filename = f'icon{size}.png'
                resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
                resized_img.save(new_filename)
                print(f"Generated {new_filename}")
    except ImportError:
        print("Error: Pillow library not found. Please install it using 'pip install pillow'")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    resize_icons()
