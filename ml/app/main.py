import os
import random
import string
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional

import aiofiles
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.model import process_image_with_detr, DetectionResult

app = FastAPI(title="Cafe Guest Counter API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent.parent
IMG_DIR = BASE_DIR / "img"
PROCESSED_DIR = BASE_DIR / "processed"
STATS_FILE = PROCESSED_DIR / "stats.txt"

IMG_DIR.mkdir(exist_ok=True)
PROCESSED_DIR.mkdir(exist_ok=True)

class ImageInfo(BaseModel):
    id: str
    filename: str
    original_filename: str
    uploaded_at: str
    status: str = "pending"
    guest_count: Optional[int] = None
    processing_time: Optional[float] = None

class ProcessBatchRequest(BaseModel):
    image_ids: List[str]

class ProcessResponse(BaseModel):
    image_id: str
    status: str
    guest_count: int
    processing_time: float
    message: str

class StatisticsResponse(BaseModel):
    total_images: int
    total_guests: int
    avg_guests_per_image: float
    recent_images: List[ImageInfo]

image_store: Dict[str, ImageInfo] = {}

def generate_image_id() -> str:
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(7))

# stats.txt
def save_stats_to_txt(image_id: str, result: DetectionResult, processing_time: float):
    confidences = [f"{det['confidence']:.3f}" for det in result.detections]
    confidences_str = ",".join(confidences) if confidences else "none"
    timestamp = datetime.now().strftime("%Y.%m.%d %H:%M")

    stats_line = (f"{timestamp} "
                  f"{image_id} "
                  f"{result.person_count} "
                  f"{processing_time:.3f} "
                  f"[{confidences_str}]\n")
    
    with open(STATS_FILE, 'a', encoding='utf-8') as f:
        f.write(stats_line)

def load_all_stats() -> List[dict]:
    if not STATS_FILE.exists():
        return []
    
    stats_data = []
    with open(STATS_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
                
            # parse ts id people_count process_time [confidences]
            try:
                parts = line.split(' ')
                if len(parts) >= 5:
                    timestamp = parts[0] + " " + parts[1]
                    image_id = parts[2]
                    people_count = int(parts[3])
                    process_time = float(parts[4])
                    confidences_str = ' '.join(parts[5:])
                    
                    if confidences_str.startswith('[') and confidences_str.endswith(']'):
                        confidences = confidences_str[1:-1].split(',')
                        confidences = [float(c) for c in confidences if c and c != 'none']
                    else:
                        confidences = []
                    
                    stats_data.append({
                        'timestamp': timestamp,
                        'id': image_id,
                        'people_count': people_count,
                        'process_time': process_time,
                        'confidences': confidences
                    })
            except Exception as e:
                print(f"Ошибка парсинга строки: {line}. Ошибка: {e}")
                continue
    
    return stats_data

@app.on_event("startup")
async def startup_event():
    print("SERVER STARTED")
    print(f"IMG dir: {IMG_DIR.absolute()}")
    print(f"RESULTS dir: {PROCESSED_DIR.absolute()}")

@app.get("/")
async def root():
    return {
        "message": "Guest Counter API",
        "version": "1.1.0",
        "endpoints": {
            "upload": "POST /upload - загрузить изображение",
            "process": "POST /process/{image_id} - обработать изображение",
            "statistics": "GET /statistics - получить статистику",
            "list_images": "GET /images - список изображений",
            "get_image": "GET /image/{image_id} - получить информацию об изображении",
            "download_image": "GET /download/{filename} - скачать изображение"
        }
    }

@app.post("/upload")
async def upload_image(files: List[UploadFile] = File(None),
    file: UploadFile = File(None)):
    """Загрузка на сервер / FormData"""
    uploaded_images = []

    files_to_process = []
    if files:
        files_to_process = files
    elif file:
        files_to_process = [file]
    else:
        raise HTTPException(status_code=400, detail="Не указаны файлы для загрузки")
    
    for f in files_to_process:
        if not f.content_type.startswith("image/"):
            continue
        
        image_id = generate_image_id()
        original_ext = os.path.splitext(f.filename)[1]
        filename = f"{image_id}{original_ext}"
        filepath = IMG_DIR / filename
        
        async with aiofiles.open(filepath, "wb") as buffer:
            content = await f.read()
            await buffer.write(content)
        
        image_info = ImageInfo(
            id=image_id,
            filename=filename,
            original_filename=f.filename,
            uploaded_at=datetime.now().isoformat(),##################################################3
            status="pending"
        )
        
        image_store[image_id] = image_info
        uploaded_images.append(image_info)
    
    if not uploaded_images:
        raise HTTPException(status_code=400, detail="Не удалось загрузить изображения")
    
    return {
        "images": uploaded_images,
        "total_uploaded": len(uploaded_images)
    }

@app.post("/process")
async def process_images(request: ProcessBatchRequest, background_tasks: BackgroundTasks):
    """Принимает массив изображений. Возращает guest_count"""
    results = []
    
    for image_id in request.image_ids:
        if image_id not in image_store:
            results.append({
                "image_id": image_id,
                "status": "failed",
                "guest_count": 0,
                "processing_time": 0,
                "message": "Изображение не найдено"
            })
            continue
        
        image_info = image_store[image_id]
        
        if image_info.status == "processing":
            results.append({
                "image_id": image_id,
                "status": "processing",
                "guest_count": 0,
                "processing_time": 0,
                "message": "Изображение уже обрабатывается"
            })
            continue
        
        if image_info.status == "completed":
            results.append({
                "image_id": image_id,
                "status": "completed",
                "guest_count": image_info.guest_count or 0,
                "processing_time": image_info.processing_time or 0,
                "message": "Изображение уже обработано"
            })
            continue
        
        image_info.status = "processing"
        
        background_tasks.add_task(
            process_image_background,
            image_id,
            image_info.filename
        )
        
        results.append({
            "image_id": image_id,
            "status": "processing",
            "guest_count": 0,
            "processing_time": 0,
            "message": "Обработка запущена"
        })
    
    return {
        "results": results,
        "total_processed": len(results)
    }

async def process_image_background(image_id: str, filename: str):
    try:
        import time
        start_time = time.time()
        filepath = IMG_DIR / filename
        
        result: DetectionResult = await process_image_with_detr(str(filepath))
        
        if result.annotated_image_path and os.path.exists(result.annotated_image_path):
            annotated_ext = os.path.splitext(filename)[1]
            annotated_filename = f"{image_id}_annotated{annotated_ext}"
            annotated_path = PROCESSED_DIR / annotated_filename
            
            import shutil
            shutil.copy2(result.annotated_image_path, annotated_path)
            
            os.remove(result.annotated_image_path)
        else:
            annotated_filename = None
        
        processing_time = time.time() - start_time
        save_stats_to_txt(image_id, result, processing_time)
        
        image_info = image_store[image_id]
        image_info.status = "completed"
        image_info.guest_count = result.person_count
        image_info.processing_time = processing_time
        
        print("Operation Successful")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        if image_id in image_store:
            image_store[image_id].status = "failed"

@app.get("/images")
async def list_images():
    images = []
    
    for file_path in IMG_DIR.glob("*"):
        if file_path.suffix.lower() in ['.jpg', '.jpeg', '.png', '.bmp', '.gif']:
            filename = file_path.name
            image_id = file_path.stem 
            
            if image_id in image_store:
                img = image_store[image_id]
                images.append({
                    "id": img.id,
                    "filename": img.filename,
                    "original_filename": img.original_filename,
                    "uploaded_at": img.uploaded_at,
                    "status": img.status,
                    "guest_count": img.guest_count,
                    "processing_time": img.processing_time,
                    "download_url": f"/download/{img.filename}",
                    "annotated_url": f"/download/{image_id}_annotated{file_path.suffix}" if img.status == "completed" else None
                })
            else:
                images.append({
                    "id": image_id,
                    "filename": filename,
                    "original_filename": filename,
                    "uploaded_at": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat(),
                    "status": "pending",
                    "guest_count": None,
                    "processing_time": None,
                    "download_url": f"/download/{filename}",
                    "annotated_url": None
                })
    
    return {"images": images}

@app.get("/image/{image_id}")
async def get_image_info(image_id: str):
    if image_id in image_store:
        img = image_store[image_id]
        return {
            "id": img.id,
            "filename": img.filename,
            "original_filename": img.original_filename,
            "uploaded_at": img.uploaded_at,
            "status": img.status,
            "guest_count": img.guest_count,
            "processing_time": img.processing_time,
            "download_url": f"/download/{img.filename}",
            "annotated_url": f"/download/{image_id}_annotated{Path(img.filename).suffix}" if img.status == "completed" else None
        }
    
    for ext in ['.jpg', '.jpeg', '.png', '.bmp', '.gif']:
        filepath = IMG_DIR / f"{image_id}{ext}"
        if filepath.exists():
            return {
                "id": image_id,
                "filename": filepath.name,
                "original_filename": filepath.name,
                "uploaded_at": datetime.fromtimestamp(filepath.stat().st_mtime).isoformat(),
                "status": "pending",
                "guest_count": None,
                "processing_time": None,
                "download_url": f"/download/{filepath.name}",
                "annotated_url": None
            }
    
    raise HTTPException(status_code=404, detail="Изображение не найдено")

@app.get("/download/{filename}")
async def download_file(filename: str):
    """Скачать из processed"""
    # img_path = IMG_DIR / filename
    # if img_path.exists():
    #     return FileResponse(
    #         path=img_path,
    #         filename=filename,
    #         media_type="image/jpeg" if filename.lower().endswith(('.jpg', '.jpeg')) else "image/png"
    #     )
    
    processed_path = PROCESSED_DIR / filename
    if processed_path.exists():
        return FileResponse(
            path=processed_path,
            filename=filename,
            media_type="image/jpeg" if filename.lower().endswith(('.jpg', '.jpeg')) else "image/png"
        )
    
    raise HTTPException(status_code=404, detail="Файл не найден")

@app.get("/stats/all")
async def get_raw_stats():
    if not STATS_FILE.exists():
        return {"stats": []}
    
    stats_data = load_all_stats()
    return {"stats": stats_data}

app.mount("/img", StaticFiles(directory=str(IMG_DIR)), name="img")
app.mount("/processed", StaticFiles(directory=str(PROCESSED_DIR)), name="processed")