import http.server, ssl

server_address = ('', 4443)
httpd = http.server.HTTPServer(server_address, http.server.SimpleHTTPRequestHandler)
httpd.socket = ssl.wrap_socket(httpd.socket,
                               server_side=True,
                               certfile='localhost.pem')
print("Serving at 4443")
import webbrowser
webbrowser.open('https://localhost:4443', new=2)
httpd.serve_forever()
