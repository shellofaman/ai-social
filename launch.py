from flask import Flask, redirect, url_for, send_file
from flask import render_template
from flask import request
from flask import session
from openai import OpenAI
from pydantic import BaseModel
from flask import g
from flask import json
from werkzeug.exceptions import HTTPException, NotFound, BadRequest, InternalServerError, Unauthorized
import sqlite3
import os
import shutil
import datetime
import requests
import jwt
import boto3
import base64

app = Flask(__name__)
app.secret_key = os.getenv("SESSION_SECRET")
client = OpenAI()
s3 = boto3.client("s3")
DATABASE = os.getenv("DATABASE_PATH")

def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
    return db

def setup_database():
    con = get_db()
    cur = con.cursor()
    try:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS prompt (
                prompt TEXT,
                created_at TEXT
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS image (
                url TEXT,
                prompt_id INT,
                created_at TEXT
            )
        """)
        con.commit()
    except Exception as e:
        print(e)
        raise InternalServerError()
    finally:
        con.close()
with app.app_context():
    setup_database()

class PromptData(BaseModel):
    prompts: list[str]

def activate_session():
    now = datetime.datetime.now()
    expires_at = now + datetime.timedelta(hours=1)
    print("TODO: destroy any unexpired tokens")
    session["key"] = jwt.encode({ "exp": expires_at.timestamp() }, app.secret_key, algorithm="HS256")
    session["TESTING"] = True

@app.before_request
def before_request_func():
    if check_url_rule(request.url_rule):
        return None
    elif request.authorization is None:
        raise Unauthorized()
    elif request.authorization is not None:
        try:
            jwt.decode(request.authorization.token, app.secret_key, algorithms="HS256")
        except Exception as e:
            raise Unauthorized()

def check_url_rule(urlObject):
    if urlObject is None:
        print("No url rule")
        return True
    if urlObject.rule == "/login" or urlObject.rule.startswith("/images"):
        return True
    if urlObject.rule.startswith("/static/"):
        if request.path.startswith("/static/js/") or request.path.startswith("/static/css/"):
            return True
    if not urlObject.rule.startswith("/api"):
        return True
            
@app.get("/login")
def login():
    return render_template("login.html")

@app.post("/login")
def api_login():
    if not request.form["passcode"]:
        raise BadRequest()
    if request.form["passcode"] == os.getenv("PASSCODE"):
        activate_session()
        return {"token":session["key"]}, 201
    else:
        raise Unauthorized()

@app.get("/")
def index():
    return render_template("index.html")

@app.get("/prompts")
def show_prompts():
    return render_template("prompts.html")

@app.get("/prompt/<prompt_id>")
def show_prompt(prompt_id):
    if not prompt_id:
        raise BadRequest()
    return render_template("prompt.html")

@app.get("/images")
def show_images():
    return render_template("images.html")

@app.get("/images/<filename>")
def show_image_file(filename):
    image_path = os.path.join("images", filename)
    if not os.path.exists(image_path):
        raise NotFound()
    return send_file(image_path, mimetype='image/png')

@app.get("/post/<image_id>")
def show_post(image_id):
    if not image_id:
        raise BadRequest()
    return render_template("post.html")

@app.get("/api/prompts")
def api_show_prompts():
    prompts = retrieve_prompts()
    return prompts, 200

@app.post("/api/prompts")
def api_generate_prompts():
    if session["TESTING"] == False:
        prompts = request_prompts()
        return {"prompts": prompts}, 201
    else:
        return {"prompts":["Prompt 1", "Prompt 2", "Prompt 3"]}, 201
    
@app.post("/api/prompt")
def api_save_prompt():
    if not request.form["prompt"]:
        raise BadRequest()
    result = save_prompt_db(request.form["prompt"])
    return {"prompt":result}, 201

@app.post("/api/image")
def api_generate_image():
    if not request.form["prompt"] and not int(request.form["prompt_id"]):
        raise BadRequest()
    if session["TESTING"] == False:
        image_url = request_image(request.form["prompt"])
        filename = save_image(image_url)
        write_image_db(filename, int(request.form["prompt_id"]))
        return {"image": filename}, 201
    else:
        return {"image": "default-image.png"}, 201

@app.get("/api/prompt/<prompt_id>")
def api_show_prompt(prompt_id):
    if not prompt_id:
        raise BadRequest()
    prompt = retrieve_prompt(prompt_id)
    return prompt, 200

@app.put("/api/prompt/<prompt_id>")
def api_update_prompt(prompt_id):
    if not prompt_id:
        raise BadRequset()
    if not request.form["text"]:
        raise BadRequest()
    prompt = update_prompt(prompt_id, request.form["text"])
    return prompt, 200

@app.get("/api/prompt/<prompt_id>/images")
def api_show_images_for_prompt(prompt_id):
    if not prompt_id:
        raise BadRequest()
    images = retrieve_images(prompt_id)
    return images, 200

# @app.delete("/api/prompt/<prompt_id>/image/<image_id>")
# def api_delete_image(prompt_id, image_id):
#     if not prompt_id or not image_id:
#         raise BadRequest()
#     image_url = delete_image_db(prompt_id, image_id)
#     move_image(image_url)
#     return image_id, 200

@app.get("/api/image/<image_id>")
def api_show_image(image_id):
    if not image_id:
        raise BadRequest()
    image = retrieve_image(image_id)
    return image, 200

@app.get("/api/images")
def api_show_images():
    images = retrieve_all_images()
    return images, 200

@app.post("/api/post/<image_id>")
def api_post_image(image_id):
    if not image_id:
        raise BadRequest()
    post_instagram(image_id, request.form["caption"])
    return {"message":"Image posted"}, 200

@app.route("/api/status", methods=["GET", "PUT"])
def api_testing():
    if request.method == "PUT":
        session["TESTING"] = not session["TESTING"]
    return {"testing":session["TESTING"]}, 200

@app.delete("/api/logout")
def api_logout():
    session.clear()
    return {"message":"Logged out"}, 200

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
        raise InternalServerError()

def request_image(prompt):
    response = client.images.generate(
        model="dall-e-2",
        prompt=prompt,
        size="1024x1024",
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
        raise InternalServerError()
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
        raise InternalServerError()
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
        raise InternalServerError()
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
        raise InternalServerError()
    finally:
        con.close()
    
def save_image(url):
    time = datetime.datetime.now()
    filename = "image-" + time.strftime("%Y-%m-%dT%H-%M-%S") + ".jpg"
    image = requests.get(url).content
    bucket = os.getenv("S3_BUCKET")
    s3.put_object(Bucket=bucket, Key="images/" + filename, Body=image, ContentType="image/jpeg")
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
        raise InternalServerError()
    finally:
        con.close()

def retrieve_image(image_id, format="base64"):
    con = get_db()
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    try:
        query = cur.execute("SELECT ROWID, url FROM image WHERE ROWID = (?)", (image_id))
        row = query.fetchone()
        bucket = os.getenv("S3_BUCKET")
        key = "images/" + row["url"]
        image_data = s3.get_object(Bucket=bucket, Key=key)
        if format == "base64":
            image = base64.b64encode(image_data["Body"].read()).decode("utf-8")
            return {"base64":image,"url":row["url"]}
        elif format == "binary":
            return {"binary":image_data["Body"].read(),"url":row["url"]}
    except Exception as e:
        print(e)
        raise InternalServerError()
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
        images = []
        bucket = os.getenv("S3_BUCKET")
        for row in rows:
            key = "images/" + row["url"]
            image_data = s3.get_object(Bucket=bucket, Key=key)
            image_base64 = base64.b64encode(image_data["Body"].read()).decode("utf-8")
            images.append({"id":row["rowid"],"base64":image_base64})
        return images
    except Exception as e:
        print(e)
        raise InternalServerError()
    finally:
        con.close()

def retrieve_all_images():
    con = get_db()
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    images = []
    try:
        query = cur.execute("SELECT ROWID, url, prompt_id FROM image ORDER BY created_at")
        rows = query.fetchall()
        for row in rows:
            images.append({"id":row["rowid"],"url":row["url"],"prompt_id":row["prompt_id"]})
        return images
    except Exception as e:
        print(e)
        raise InternalServerError()
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
        raise InternalServerError()
    finally:
        con.close()

# def move_image(url):
#     cur_destination = f"static\\assets\\images\\{url}"
#     new_destination = f"static\\assets\\images_deleted\\{url}"
#     shutil.move(cur_destination, new_destination)

def post_instagram(image_id, caption):
    try:
        image_url = get_image_url(image_id)
        signed_url = get_signed_url(image_url)
        print(signed_url)
    except Exception as e:
        print(e)
        raise InternalServerError()

def get_image_url(image_id):
    con = get_db()
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    try:
        query = cur.execute("SELECT ROWID, url FROM image WHERE ROWID = (?)", (image_id))
        row = query.fetchone()
        return row["url"]
    except Exception as e:
        print(e)
        raise InternalServerError()
    finally:
        con.close()

def get_signed_url(url):
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": os.getenv("S3_BUCKET"), "Key": "images/" + url},
        ExpiresIn=300
    )

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()
