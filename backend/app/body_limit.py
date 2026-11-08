from starlette.responses import JSONResponse

class RequestBodyLimit:
    """Bound request bodies even when Content-Length is absent or misleading."""
    def __init__(self,app,max_bytes):
        self.app=app
        self.max_bytes=max_bytes

    async def __call__(self,scope,receive,send):
        if scope['type']!='http' or scope.get('method') in ('GET','HEAD','OPTIONS'):
            return await self.app(scope,receive,send)
        chunks=[];size=0
        while True:
            message=await receive()
            if message['type']=='http.disconnect': return
            chunk=message.get('body',b'');size+=len(chunk)
            if size>self.max_bytes:
                return await JSONResponse({'detail':'Request too large. File upload limit is 5 MB.'},status_code=413)(scope,receive,send)
            chunks.append(chunk)
            if not message.get('more_body',False): break
        delivered=False
        async def bounded_receive():
            nonlocal delivered
            if not delivered:
                delivered=True
                return {'type':'http.request','body':b''.join(chunks),'more_body':False}
            return await receive()
        await self.app(scope,bounded_receive,send)
