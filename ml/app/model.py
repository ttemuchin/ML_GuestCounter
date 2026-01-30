import torch
import numpy as np
from PIL import Image, ImageDraw
import time
from typing import List, Tuple, Optional
from dataclasses import dataclass
import asyncio
import os
import io

from transformers import DetrImageProcessor, DetrForObjectDetection

@dataclass
class DetectionResult:
    person_count: int
    detections: List[dict]
    processing_time: float
    annotated_image_path: Optional[str] = None

class DETRModel:    
    def __init__(self, model_name: str = "facebook/detr-resnet-50"):
        print(f"Загрузка модели DETR: {model_name}")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Используемое устройство: {self.device}")
        
        self.processor = DetrImageProcessor.from_pretrained(model_name)
        self.model = DetrForObjectDetection.from_pretrained(model_name)
        self.model.to(self.device)
        self.model.eval()
        
        print("!!! Модель DETR загружена и готова к работе !!!")
        
        self.COCO_CLASSES = [
            'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck',
            'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench',
            'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra',
            'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
            'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
            'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup',
            'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
            'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
            'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
            'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
            'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier',
            'toothbrush'
        ]
    
    def fix_corrupted_image(self, image_path: str) -> Optional[Image.Image]:
        try:
            with open(image_path, 'rb') as f:
                img_bytes = f.read()
            
            for method in [Image.open, self._try_open_from_bytes]:
                try:
                    if method == Image.open:
                        img = Image.open(image_path)
                        img.verify()
                        img = Image.open(image_path)
                    else:
                        img = method(img_bytes)
                    
                    img = img.convert("RGB")
                    print(f"Изображение восстановлено: {image_path}")
                    return img
                    
                except Exception:
                    continue
            
            return None
            
        except Exception as e:
            print(f"Не удалось восстановить изображение {image_path}: {e}")
            return None
    
    def _try_open_from_bytes(self, img_bytes: bytes) -> Optional[Image.Image]:
        try:
            img = Image.open(io.BytesIO(img_bytes))
            return img
        except:
            return None
    
    def _iou(self, box1: List[float], box2: List[float]) -> float:
        x1, y1, x2, y2 = box1
        x1_p, y1_p, x2_p, y2_p = box2
        
        # пересечениe
        xi1 = max(x1, x1_p)
        yi1 = max(y1, y1_p)
        xi2 = min(x2, x2_p)
        yi2 = min(y2, y2_p)
        
        inter_area = max(0, xi2 - xi1) * max(0, yi2 - yi1)
        
        box1_area = (x2 - x1) * (y2 - y1)
        box2_area = (x2_p - x1_p) * (y2_p - y1_p)
        
        # IoU
        union_area = box1_area + box2_area - inter_area
        return inter_area / union_area if union_area > 0 else 0
    
    def _filter_overlapping_detections(self, detections: List[dict], iou_threshold: float = 0.5) -> List[dict]:
        if not detections:
            return detections
        
        sorted_detections = sorted(detections, key=lambda x: x["confidence"], reverse=True)
        
        filtered = []
        while sorted_detections:
            current = sorted_detections.pop(0)
            filtered.append(current)
            
            remaining = []
            for det in sorted_detections:
                iou_score = self._iou(current["bbox"], det["bbox"])
                if iou_score < iou_threshold:
                    remaining.append(det)
            
            sorted_detections = remaining
        
        return filtered
    
    def detect_people(self, image_path: str, confidence_threshold: float = 0.7) -> DetectionResult:
        start_time = time.time()
        
        try:
            try:
                image = Image.open(image_path).convert("RGB")
            except Exception as e:
                print(f"Ошибка открытия изображения {image_path}: {e}")
                print("Пробуем восстановить изображение..")
                
                image = self.fix_corrupted_image(image_path)
                if image is None:
                    print(f"Не удалось обработать изображение {image_path}")
                    return DetectionResult(
                        person_count=0,
                        detections=[],
                        processing_time=time.time() - start_time,
                        annotated_image_path=None
                    )
        
        except Exception as e:
            print(f"Критическая ошибка при открытии {image_path}: {e}")
            return DetectionResult(
                person_count=0,
                detections=[],
                processing_time=time.time() - start_time,
                annotated_image_path=None
            )
        
        try:
            inputs = self.processor(images=image, return_tensors="pt")
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            with torch.no_grad():
                outputs = self.model(**inputs)
            
            target_sizes = torch.tensor([image.size[::-1]]).to(self.device)
            results = self.processor.post_process_object_detection(
                outputs, 
                target_sizes=target_sizes,
                threshold=confidence_threshold
            )[0]
            
            person_indices = torch.where(results["labels"] == 1)[0]
            person_scores = results["scores"][person_indices]
            person_boxes = results["boxes"][person_indices]
            
            detections = []
            for score, box in zip(person_scores, person_boxes):
                box = box.cpu().numpy().tolist()
                detections.append({
                    "bbox": box,
                    "confidence": float(score),
                    "class": "person",
                    "class_id": 1
                })
            
            # ФИЛЬТРАЦИЯ ПЕРЕКРЫВАЮЩИХСЯ BBOX
            detections = self._filter_overlapping_detections(detections, iou_threshold=0.5)
            
            image_name = os.path.basename(image_path)
            image_id = os.path.splitext(image_name)[0]
            temp_dir = "temp_annotations"
            os.makedirs(temp_dir, exist_ok=True)
            
            annotated_image = self.annotate_image(image, detections)
            annotated_filename = f"{image_id}_annotated_temp.jpg"
            annotated_path = os.path.join(temp_dir, annotated_filename)
            annotated_image.save(annotated_path)
            
            processing_time = time.time() - start_time
            
            return DetectionResult(
                person_count=len(detections),
                detections=detections,
                processing_time=processing_time,
                annotated_image_path=annotated_path
            )
            
        except Exception as e:
            print(f"Ошибка при обработке модели {image_path}: {e}")
            return DetectionResult(
                person_count=0,
                detections=[],
                processing_time=time.time() - start_time,
                annotated_image_path=None
            )
    
    def annotate_image(self, image: Image.Image, detections: List[dict]) -> Image.Image:
        draw = ImageDraw.Draw(image)
        
        colors = ["red", "blue", "green", "yellow", "purple", "orange"]
        
        for i, detection in enumerate(detections):
            bbox = detection["bbox"]
            confidence = detection["confidence"]
            
            # отрисовка bounding box
            color = colors[i % len(colors)]
            draw.rectangle(bbox, outline=color, width=3)
            
            label = f"Person {i+1}: {confidence:.2f}"
            draw.text((bbox[0], bbox[1] - 20), label, fill=color)
        
        count_text = f"Total People: {len(detections)}"
        draw.text((10, 10), count_text, fill="white", stroke_fill="black", stroke_width=2)
        
        return image

detr_model = None

def get_detr_model():
    global detr_model
    if detr_model is None:
        detr_model = DETRModel()
    return detr_model

async def process_image_with_detr(image_path: str) -> DetectionResult:
    loop = asyncio.get_event_loop()
    model = get_detr_model()
    
    result = await loop.run_in_executor(
        None, 
        model.detect_people, 
        image_path
    )
    
    return result

def cleanup_temp_files():
    temp_dir = "temp_annotations"
    if os.path.exists(temp_dir):
        for file in os.listdir(temp_dir):
            try:
                os.remove(os.path.join(temp_dir, file))
            except:
                pass