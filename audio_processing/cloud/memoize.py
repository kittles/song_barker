from functools import partial


class memoize (object):


    def __init__ (self, func):
        self.func = func


    def __get__ (self, obj, objtype=None):
        if obj is None:
            return self.func
        return partial(self, obj)


    def __call__ (self, *args, **kw):
        obj = args[0]
        try:
            cache = obj.__cache
        except AttributeError:
            cache = obj.__cache = {}
        key = (self.func, args[1:], frozenset(kw.items()))
        try:
            res = cache[key]
        except KeyError:
            res = cache[key] = self.func(*args, **kw)
        return res
