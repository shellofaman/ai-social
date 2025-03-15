from flask import Flask
from flask import render_template
from flask import request
from openai import OpenAI
from pydantic import BaseModel
from flask import g
from flask import json
from werkzeug.exceptions import HTTPException, NotFound, BadRequest, InternalServerError
import sqlite3
import os
import shutil
import datetime
import requests

app = Flask(__name__)
client = OpenAI()
TESTING = True
DATABASE = "database.db"

class PromptData(BaseModel):
    prompts: list[str]

def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
    return db

@app.get("/")
def index():
    return render_template("index.html")

@app.get("/prompts")
def show_prompts():
    try:
        prompts_list = retrieve_prompts()
        return render_template("prompts.html.jinja", prompts=prompts_list)
    except:
        return render_template("prompts.html.jinja", prompts=[])

@app.post("/prompts")
def generate_prompts():
    try:
        if not TESTING:
            prompts = request_prompts()
            return {"prompts": prompts}
        else:
            return {"prompts":["Prompt 1", "Prompt 2", "Prompt 3"]}
    except:
        return {"message": "An error occurred", "status": 500}
    
@app.post("/prompt")
def save_prompt():
    if not request.form["prompt"]:
        return {"message": "Bad request", "status": 400}
    result = save_prompt_db(request.form["prompt"])
    return {"prompt":result}

@app.post("/image")
def generate_image():
    if not request.form["prompt"] and not int(request.form["prompt_id"]):
        return {"message": "Bad request", "status": 400}
    
    if not TESTING:
        image_url = request_image(request.form["prompt"])
        filename = save_image(image_url)
        write_image_db(filename, int(request.form["prompt_id"]))
        return {"image": filename}
    else:
        return {"image": "default-image.png"}

@app.get("/prompt/<prompt_id>")
def show_prompt(prompt_id):
    if not prompt_id:
        return {"message": "Bad request", "status": 400}
    
    prompt = retrieve_prompt(prompt_id)
    return render_template("prompt.html.jinja", prompt=prompt)

@app.put("/prompt/<prompt_id>")
def update_prompt(prompt_id):
    if not prompt_id:
        raise BadRequset()
    if not request.form["text"]:
        raise BadRequest()
    prompt = update_prompt(prompt_id, request.form["text"])
    return {"prompt": prompt}

@app.get("/prompt/<prompt_id>/images")
def show_images(prompt_id):
    if not prompt_id:
        return {"message": "Bad request", "status": 400}
    
    images = retrieve_images(prompt_id)
    return {"images": images}

@app.delete("/prompt/<prompt_id>/image/<image_id>")
def delete_image(prompt_id, image_id):
    if not prompt_id or not image_id:
        raise BadRequest()
    image_url = delete_image_db(prompt_id, image_id)
    move_image(image_url)
    return {"id": image_id}

@app.get("/authenticated")
def auth_page():
    return "Hello world"
        
def request_prompts():
    try:
        completion = client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {"role":"system","content":"Generate 3 prompt ideas."},
                {"role":"user","content":"Generate 3 unique prompts I can send to DALL-E to create fun emoji icon images for instagram."}
            ],
            response_format=PromptData
        )
        raw_prompts = completion.choices[0].message.parsed.prompts
        return raw_prompts
    except Exception as e:
        print(e)
        raise InternalServerError(original_exception = e)

def request_image(prompt):
    response = client.images.generate(
        model="dall-e-2",
        prompt=prompt,
        size="1024x1024",
        quality="standard",
        n=1
    )
    return response.data[0].url

def retrieve_prompts():
    con = get_db()
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    prompts = []
    try:
        result = cur.execute("SELECT ROWID, prompt FROM prompt ORDER BY ROWID LIMIT 15")
        rows = result.fetchall()
        prompts = [{"id":r["rowid"],"text":r["prompt"]} for r in rows]
        return prompts
    except Exception as e:
        print(e)
        raise InternalServerError(original_exception=e)
    finally:
        con.close()

def retrieve_prompt(prompt_id):
    con = get_db()
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    try:
        query = cur.execute(
            "SELECT ROWID, prompt FROM prompt WHERE ROWID = (?)",
            (prompt_id)
        )
        row = query.fetchone()
        return {"id":row["rowid"],"text":row["prompt"]}
    except Exception as e:
        print(e)
        raise InternalServerError(original_exception=e)
    finally:
        con.close()

def update_prompt(prompt_id, text):
    con = get_db()
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    try:
        cur.execute(
            "UPDATE prompt SET prompt = (?) WHERE rowid = (?)",
            (text, prompt_id)
        )
        con.commit()
        cur.execute(
            "SELECT rowid, prompt FROM prompt WHERE rowid = (?)",
            (prompt_id)
        )
        row = cur.fetchone()
        return {"id":row["rowid"],"text":row["prompt"]}
    except Exception as e:
        print(e)
        raise InternalServerError(original_exception=e)
    finally:
        con.close()

def save_prompt_db(text):
    con = get_db()
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    try:
        cur.execute(
            "INSERT INTO prompt VALUES(?,?)",
            (text, datetime.datetime.now())
        )
        con.commit()
        cur.execute("SELECT rowid, prompt FROM prompt ORDER BY rowid DESC")
        row = cur.fetchone()
        return {"id":row["rowid"],"text":row["prompt"]}
    except Exception as e:
        print(e)
        raise InternalServerError(original_exception=e)
    finally:
        con.close()
    
def save_image(url):
    os.chdir("static\\assets\\images")
    image_dir = os.getcwd()
    time = datetime.datetime.now()
    filename = "image-" + time.strftime("%Y-%m-%dT%H-%M-%S") + ".png"
    image = requests.get(url).content
    with open(filename, "wb") as f:
        f.write(image)
    os.chdir("../../../")
    return filename

def write_image_db(filename, prompt_id):
    con = get_db()
    cur = con.cursor()
    try:
        cur.execute(
            "INSERT INTO image VALUES(?, ?, ?)",
            (filename, prompt_id, datetime.datetime.now())
        )
        con.commit()
    except Exception as e:
        print(e)
        raise InternalServerError(original_exception=e)
    finally:
        con.close()

def retrieve_images(prompt_id):
    con = get_db()
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    try:
        query = cur.execute(
            "SELECT ROWID, url FROM image WHERE prompt_id = (?) ORDER BY created_at",
            (prompt_id)
        )
        rows = query.fetchall()
        return [{"id":r["rowid"],"url":r["url"]} for r in rows]
    except Exception as e:
        print(e)
        raise InternalServerError(original_exception=e)
    finally:
        con.close()

def delete_image_db(prompt_id, image_id):
    con = get_db()
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    try:
        query = f"SELECT ROWID, url FROM image WHERE prompt_id = {prompt_id} AND ROWID = {image_id};"
        result = cur.execute(query)
        row = result.fetchone()
        if row is None:
            raise NotFound()
        delete_query = f"DELETE FROM image WHERE ROWID = {image_id};"
        cur.execute(delete_query)
        con.commit()
        return row["url"]
    except Exception as e:
        print(e)
        raise InternalServerError(original_exception=e)
    finally:
        con.close()

def move_image(url):
    cur_destination = f"static\\assets\\images\\{url}"
    new_destination = f"static\\assets\\images_deleted\\{url}"
    shutil.move(cur_destination, new_destination)

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()
